/**
 * `AnalyticsWriterService` consumes the three downstream wire events the
 * processor emits and fans them out into five ClickHouse tables in parallel:
 * `events_v2` (processed events), `persons_v1` (person profiles),
 * `person_identity_v1` (identity mappings), `person_identity_overrides_v1`
 * (override snapshots), and `person_identity_pending_overrides_v2` (merge queue).
 *
 * It yields {@link ClickhouseWebClient} directly (the Workers-safe driver) and
 * uses Postgres only to resolve organization ids for person/identity rows. A
 * runtime without ClickHouse acknowledges messages with zero inserted rows.
 */
import { Db } from "@voidhash/db";
import { causeMessage, constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Option, Schema } from "effect";

import {
  type AnalyticsWriterMessageType,
  buildAnalyticsWriterPlan,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
} from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";

// Unqualified table names — the runtime Clickhouse client connects with the
// per-stage database (provisioned by `Clickhouse.Database`) as its default,
// so these resolve correctly without a hardcoded database prefix.
const CLICKHOUSE_EVENTS_FULL_TABLE = constant("events_v2");
const CLICKHOUSE_PERSONS_FULL_TABLE = constant("persons_v1");
const CLICKHOUSE_PERSON_IDENTITY_FULL_TABLE = constant("person_identity_v1");
const CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_FULL_TABLE = constant("person_identity_overrides_v1");
const CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_FULL_TABLE = constant(
  "person_identity_pending_overrides_v2",
);

export class AnalyticsWriterServiceError extends Schema.TaggedErrorClass<AnalyticsWriterServiceError>(
  "AnalyticsWriterServiceError",
)("AnalyticsWriterServiceError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface WriteAnalyticsResult {
  readonly insertedRowCount: number;
  readonly messageCount: number;
}

interface FetchExistingEventKeyRow {
  project_id: string;
  event_id: string;
}

// Event dedup is scoped PER PROJECT and UNBOUNDED IN TIME: event_id derives from
// a stable id (the SDK client uuid, or the deterministic revenue id), so two
// tenants could send the same string. Keying on (project_id, event_id) stops one
// tenant's id from masking another's; length-prefixing the server-issued
// project_id keeps the key injective even if an event_id contains a separator.
// This is the SOLE dedup authority — `fetchExistingEventKeys` checks the whole
// batch against ClickHouse with no time bound, so a re-dispatched revenue event
// collapses no matter how late it arrives.
const eventDedupKey = (projectId: string, eventId: string): string =>
  `${projectId.length}:${projectId}${eventId}`;

/** True for a trusted-revenue processed-event row (carries a deterministic `event_id`). */
export const isRevenueAnalyticsWriterRow = (row: Readonly<Record<string, unknown>>): boolean =>
  row.source_topic === REVENUE_TRUSTED_SOURCE_TOPIC &&
  typeof row.event_name === "string" &&
  isReservedRevenueEventName(row.event_name);

interface RevenueBatchDedupeResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly skippedCount: number;
}

/**
 * Collapse trusted-revenue rows that appear twice in the SAME write batch (first
 * seen wins, keyed on the deterministic `event_id`). Cross-batch and
 * already-stored duplicates are caught by the unbounded `fetchExistingEventKeys`
 * check; non-revenue rows pass through untouched.
 */
export const dedupeRevenueRowsWithinBatch = (
  rows: ReadonlyArray<Record<string, unknown>>,
): RevenueBatchDedupeResult => {
  const seen = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (!isRevenueAnalyticsWriterRow(row) || typeof row.event_id !== "string") {
      deduped.push(row);
      continue;
    }
    const eventId = row.event_id;
    if (seen.has(eventId)) {
      skippedCount++;
      continue;
    }
    seen.add(eventId);
    deduped.push(row);
  }

  if (skippedCount === 0) {
    return { rows, skippedCount };
  }
  return { rows: deduped, skippedCount };
};

export class AnalyticsWriterService extends Context.Service<AnalyticsWriterService>()(
  "AnalyticsWriterService",
  {
    make: Effect.gen(function* () {
      const ch = Option.getOrUndefined(
        yield* Effect.serviceOption(ClickhouseWebClient.ClickhouseWebClient),
      );
      const db = yield* Db;

      // ClickHouse Cloud prefers large, infrequent inserts; the ingest consumer
      // already folds a whole queue delivery into one `writeMessages` call, and
      // `async_insert` lets the server coalesce parts server-side — the defence
      // against the "too many parts" failure mode of small frequent inserts.
      // `wait_for_async_insert: 1` keeps the write durable and backpressured:
      // the insert resolves only once the server buffer has been flushed.
      const insertRows = (table: string, rows: ReadonlyArray<Record<string, unknown>>) => {
        if (rows.length === 0 || ch === undefined) {
          return Effect.void;
        }
        return ch
          .withClickhouseSettings(ch.insertQuery({ table, values: rows }), {
            async_insert: 1,
            wait_for_async_insert: 1,
          })
          .pipe(Effect.asVoid);
      };

      const fetchExistingEventKeys = (
        projectIds: ReadonlyArray<string>,
        ids: ReadonlyArray<string>,
      ) => {
        if (ids.length === 0 || ch === undefined) return Effect.succeed(new Set<string>());
        return ch<FetchExistingEventKeyRow>`SELECT project_id, event_id FROM ${ch.literal(CLICKHOUSE_EVENTS_FULL_TABLE)}
             WHERE project_id IN ${ch.param("Array(String)", projectIds)}
               AND event_id IN ${ch.param("Array(String)", ids)}`.pipe(
          Effect.map(
            (rows) => new Set(rows.map((row) => eventDedupKey(row.project_id, row.event_id))),
          ),
        );
      };

      const writeMessages = Effect.fn("writeMessages")(
        function* (messages: ReadonlyArray<AnalyticsWriterMessageType>) {
          yield* Effect.annotateCurrentSpan("voidhash.writer.message_count", messages.length);
          if (ch === undefined) {
            return { insertedRowCount: 0, messageCount: messages.length };
          }
          let dedupSkippedTotal = 0;

          // Person / identity messages carry only `project_id`; resolve each to its
          // `organization_id` (one MySQL lookup per batch over the distinct projects)
          // so the written rows match the readonly user's tenant row policies.
          // Processed events already carry their organization id.
          const organizationProjectIds = [
            ...new Set(
              messages
                .filter((m) => m.kind === "person" || m.kind === "person-distinct-id")
                .map((m) => m.value.projectId),
            ),
          ];
          let organizationByProject = new Map<string, string>();
          if (organizationProjectIds.length > 0) {
            const organizationRows = yield* db.query.projects.findMany({
              columns: { id: true, organizationId: true },
              where: { id: { in: organizationProjectIds } },
            });
            organizationByProject = new Map(
              organizationRows.map((row) => [row.id, row.organizationId]),
            );
          }
          const plan = buildAnalyticsWriterPlan(
            messages,
            (projectId) => organizationByProject.get(projectId) ?? "",
          );
          const batchDedupe = dedupeRevenueRowsWithinBatch(plan.processedEventRows);
          let processedEventRows = batchDedupe.rows;

          const eventIds = [...new Set(processedEventRows.map((row) => String(row.event_id)))];
          const eventProjectIds = [
            ...new Set(processedEventRows.map((row) => String(row.project_id))),
          ];
          const existingEventKeys = yield* fetchExistingEventKeys(eventProjectIds, eventIds);
          if (existingEventKeys.size > 0) {
            const beforeCount = processedEventRows.length;
            processedEventRows = processedEventRows.filter(
              (row) =>
                !existingEventKeys.has(eventDedupKey(String(row.project_id), String(row.event_id))),
            );
            dedupSkippedTotal += beforeCount - processedEventRows.length;
            yield* Effect.logInfo("skipped duplicate analytics events", {
              eventDedupReason: "clickhouse_existing",
              eventDedupSkippedCount: beforeCount - processedEventRows.length,
              eventIdsInBatch: eventIds.length,
            });
          }

          if (batchDedupe.skippedCount > 0) {
            dedupSkippedTotal += batchDedupe.skippedCount;
            yield* Effect.logInfo("skipped duplicate revenue analytics events", {
              revenueDedupReason: "incoming_batch",
              revenueDedupSkippedCount: batchDedupe.skippedCount,
            });
          }

          yield* Effect.all(
            [
              insertRows(CLICKHOUSE_EVENTS_FULL_TABLE, processedEventRows),
              insertRows(CLICKHOUSE_PERSONS_FULL_TABLE, plan.personRows),
              insertRows(CLICKHOUSE_PERSON_IDENTITY_FULL_TABLE, plan.personIdentityRows),
              insertRows(
                CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_FULL_TABLE,
                plan.personIdentityOverrideRows,
              ),
              insertRows(
                CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_FULL_TABLE,
                plan.personIdentityPendingOverrideRows,
              ),
            ],
            { concurrency: "unbounded" },
          );

          const insertedRowCount =
            processedEventRows.length +
            plan.personRows.length +
            plan.personIdentityRows.length +
            plan.personIdentityOverrideRows.length +
            plan.personIdentityPendingOverrideRows.length;

          yield* Effect.annotateCurrentSpan("voidhash.writer.inserted_row_count", insertedRowCount);
          yield* Effect.annotateCurrentSpan(
            "voidhash.writer.dedup_skipped_count",
            dedupSkippedTotal,
          );

          return {
            insertedRowCount,
            messageCount: messages.length,
          } satisfies WriteAnalyticsResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsWriterServiceError({
                    cause: error.message,
                    message: "failed to insert analytics messages",
                  }),
                ),
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AnalyticsWriterServiceError({
                    cause: causeMessage(error.cause ?? error.message),
                    message: "failed to resolve organization ids for analytics messages",
                  }),
                ),
            }),
          ),
      );

      return constant({ writeMessages });
    }),
  },
) {
  static readonly layer: Layer.Layer<AnalyticsWriterService, never, Db> = Layer.effect(
    AnalyticsWriterService,
  )(AnalyticsWriterService.make);

  /** Builds the writer with an explicit read-write client instead of ambient analytics access. */
  static readonly layerWithClickhouse = (
    client: ClickhouseWebClient.ClickhouseWebClient,
  ): Layer.Layer<AnalyticsWriterService, never, Db> =>
    Layer.effect(AnalyticsWriterService)(
      AnalyticsWriterService.make.pipe(
        Effect.provideService(ClickhouseWebClient.ClickhouseWebClient, client),
      ),
    );
}
