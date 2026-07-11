/**
 * `AnalyticsJanitorService` reconciles pending identity merges in ClickHouse.
 * One operation: `squash` selects a backlog of pending overrides older than the
 * safety window, materialises a per-run shared staging table + a Dictionary over
 * it, bulk `ALTER TABLE UPDATE`s the events table to assign the merged person
 * ids, deletes the squashed backlog rows, then drops the staging resources.
 *
 * Transitive convergence: this squash takes the LATEST override version per
 * `(project_id, source_distinct_id)` and applies it directly — no person-merge
 * chain-following. That is correct because the identity merge keeps overrides
 * canonical: when a person becomes non-canonical (an older person joins its
 * component), the merge repoints that person's ENTIRE distinct-id cluster onto
 * the new survivor (`PersonIdentityService.identifyDistinctId` →
 * `IdentityMutationService.listMappedDistinctIds`), so the newest override for
 * every distinct id already names the current canonical person. A transitive
 * chain A→B→C therefore collapses in a single pass.
 *
 * ClickHouse Cloud constraint (why a staging MergeTree + Dictionary): on Cloud
 * (`SharedMergeTree`) an `ALTER TABLE … UPDATE/DELETE` mutation runs
 * ASYNCHRONOUSLY on other replicas, which cannot see session/node-local
 * `ENGINE = Memory` / `ENGINE = Join` tables. So the per-run snapshot is a
 * regular `MergeTree` (transparently `SharedMergeTree`, visible cluster-wide),
 * and the per-row person-id lookup uses a `Dictionary` + `dictGet` rather than a
 * node-local Join + `joinGet`. `dictGet` is non-deterministic, so the UPDATE
 * needs `allow_nondeterministic_mutations`, passed as a session
 * `clickhouse_setting` (Cloud ignores it in a SQL `SETTINGS` clause).
 */
import { Context, Effect, Layer, Schema } from "effect";

import {
  type BacklogRow,
  computeCutoffIso,
  makeSnapshotResources,
  type SnapshotResources,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";

// Unqualified table names — the runtime Clickhouse client connects with the
// per-stage database (provisioned by `Clickhouse.Database`) as its default.
const CLICKHOUSE_EVENTS_FULL_TABLE = "events_v2" as const;
const CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_FULL_TABLE =
  "person_identity_pending_overrides_v2" as const;

export class AnalyticsJanitorServiceError extends Schema.TaggedErrorClass<AnalyticsJanitorServiceError>(
  "AnalyticsJanitorServiceError",
)("AnalyticsJanitorServiceError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface SquashInput {
  readonly batchSize: number;
  readonly safetyWindowSeconds: number;
}

export interface SquashResult {
  readonly backlogRowsProcessed: number;
  readonly cutoffIso: string;
  readonly durationMs: number;
}

export class AnalyticsJanitorService extends Context.Service<AnalyticsJanitorService>()(
  "AnalyticsJanitorService",
  {
    make: Effect.gen(function* () {
      const ch = yield* ClickhouseWebClient.ClickhouseWebClient;

      const selectBacklog = ({
        batchSize,
        cutoffIso,
      }: {
        readonly batchSize: number;
        readonly cutoffIso: string;
      }) =>
        ch<BacklogRow>`SELECT
             project_id,
             source_distinct_id,
             target_distinct_id,
             person_id,
             version,
             changed_at
           FROM (
             SELECT
               project_id,
               source_distinct_id,
               target_distinct_id,
               person_id,
               is_deleted,
               version,
               changed_at
             FROM ${ch.literal(CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_FULL_TABLE)}
             WHERE version > 0
             ORDER BY
               project_id ASC,
               source_distinct_id ASC,
               version DESC,
               changed_at DESC
             LIMIT 1 BY project_id, source_distinct_id
           )
           WHERE
             is_deleted = 0
             AND changed_at < parseDateTime64BestEffort(${ch.param("String", cutoffIso)})
           ORDER BY changed_at ASC, project_id ASC, source_distinct_id ASC
           LIMIT ${ch.param("UInt32", Math.max(0, Math.floor(batchSize)))}`;

      // Qualifies the per-run Dictionary (so an async mutation on another replica
      // resolves it unambiguously) and points its `CLICKHOUSE` source at the
      // staging table. The client's default is the per-stage analytics database.
      const currentDatabaseName = ch<{ readonly db: string }>`SELECT currentDatabase() AS db`.pipe(
        Effect.map((rows) => rows[0]?.db ?? ""),
      );

      // Per-run staging table — a regular `MergeTree` (transparently
      // `SharedMergeTree` on Cloud) so it is visible cluster-wide to the async
      // mutations below, unlike a node-local `ENGINE = Memory` table.
      const createPendingOverrideSnapshot = (resources: SnapshotResources) =>
        ch.asCommand(ch`CREATE TABLE IF NOT EXISTS ${ch.literal(resources.pendingOverrideSnapshotName)}
          (
            project_id String,
            source_distinct_id String,
            target_distinct_id String,
            person_id String,
            version UInt64,
            changed_at DateTime64(3)
          )
          ENGINE = MergeTree
          ORDER BY (project_id, source_distinct_id)`);

      const insertPendingOverrideSnapshotRows = ({
        resources,
        rows,
      }: {
        readonly resources: SnapshotResources;
        readonly rows: ReadonlyArray<BacklogRow>;
      }) =>
        rows.length === 0
          ? Effect.void
          : ch
              .insertQuery({
                table: resources.pendingOverrideSnapshotName,
                values: rows,
              })
              .pipe(Effect.asVoid);

      // Escape a value for a single-quoted ClickHouse SQL string literal — the
      // dictionary-source credentials live inside the `SOURCE(...)` clause and
      // cannot be bound as query parameters.
      const escapeChStringLiteral = (value: string): string =>
        value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

      // Per-run Dictionary over the staging table, keyed by
      // (project_id, source_distinct_id) → (person_id, version) — the ONLY per-run
      // object the mutations reference, since a Dictionary is cluster-wide and
      // resolves under an async mutation on any replica. Its `SOURCE` connects
      // back as the bound (non-`default`) user, required to authenticate the
      // `CLICKHOUSE` source on Cloud. `version` is carried so the backlog delete
      // can scope by it.
      const createPendingOverrideDictionary = ({
        databaseName,
        resources,
      }: {
        readonly databaseName: string;
        readonly resources: SnapshotResources;
      }) => {
        const dictionaryName = `${databaseName}.${resources.pendingOverrideDictionaryName}`;
        const keyColumns = [
          { name: "project_id", type: "String" },
          { name: "source_distinct_id", type: "String" },
        ];
        const attributeColumns = [
          { name: "person_id", type: "String" },
          { name: "version", type: "UInt64" },
        ];
        const columns = [...keyColumns, ...attributeColumns]
          .map((column) => `${column.name} ${column.type}`)
          .join(", ");
        const primaryKey = keyColumns.map((column) => column.name).join(", ");
        const cfg = ch.config;
        return ch.asCommand(
          ch`${ch.literal(`CREATE DICTIONARY IF NOT EXISTS ${dictionaryName} (${columns})
          PRIMARY KEY ${primaryKey}
          SOURCE(CLICKHOUSE(
            USER '${escapeChStringLiteral(cfg.username ?? "")}'
            PASSWORD '${escapeChStringLiteral(cfg.password ?? "")}'
            DB '${escapeChStringLiteral(databaseName)}'
            TABLE '${escapeChStringLiteral(resources.pendingOverrideSnapshotName)}'
          ))
          LAYOUT(COMPLEX_KEY_HASHED())
          LIFETIME(MIN 0 MAX 0)`)}`,
        );
      };

      // Passed as session `clickhouse_settings`, not a SQL `SETTINGS` clause:
      // `dictGet`/`dictHas` are non-deterministic (so the mutation needs
      // `allow_nondeterministic_mutations`), and Cloud only honours it there.
      const mutationSettings = {
        mutations_sync: "1",
        allow_nondeterministic_mutations: 1,
      } as const;

      // Resolve merged person ids purely through the Dictionary (`dictHas` gates
      // rows, `dictGet` supplies the id) so the async mutation never depends on
      // resolving the per-run staging table on its replica.
      const updatePersonIdsFromSnapshot = ({
        databaseName,
        resources,
      }: {
        readonly databaseName: string;
        readonly resources: SnapshotResources;
      }) => {
        const dictionary = `${databaseName}.${resources.pendingOverrideDictionaryName}`;
        const lookup = `dictGet('${dictionary}', 'person_id', (project_id, distinct_id))`;
        return ch.asCommand(
          ch.withClickhouseSettings(
            ch`${ch.literal(`ALTER TABLE ${CLICKHOUSE_EVENTS_FULL_TABLE}
          UPDATE person_id = ${lookup}
          WHERE dictHas('${dictionary}', (project_id, distinct_id))
          AND (
            person_id IS NULL
            OR person_id != ${lookup}
          )`)}`,
            mutationSettings,
          ),
        );
      };

      // Delete every pending-override version at-or-below the squashed version
      // (the Dictionary's `version` attribute) for each key it covers.
      const deleteSquashedBacklog = ({
        databaseName,
        resources,
      }: {
        readonly databaseName: string;
        readonly resources: SnapshotResources;
      }) => {
        const dictionary = `${databaseName}.${resources.pendingOverrideDictionaryName}`;
        return ch.asCommand(
          ch.withClickhouseSettings(
            ch`${ch.literal(`ALTER TABLE ${CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_FULL_TABLE}
          DELETE WHERE dictHas('${dictionary}', (project_id, source_distinct_id))
            AND version <= dictGetUInt64('${dictionary}', 'version', (project_id, source_distinct_id))`)}`,
            mutationSettings,
          ),
        );
      };

      const cleanupSnapshotResources = ({
        databaseName,
        resources,
      }: {
        readonly databaseName: string;
        readonly resources: SnapshotResources;
      }) =>
        Effect.gen(function* () {
          yield* ch
            .asCommand(
              ch`DROP DICTIONARY IF EXISTS ${ch.literal(`${databaseName}.${resources.pendingOverrideDictionaryName}`)}`,
            )
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logError("failed to drop pending override dictionary", {
                  cause,
                  dictionary: resources.pendingOverrideDictionaryName,
                }),
              ),
            );
          yield* ch
            .asCommand(
              ch`DROP TABLE IF EXISTS ${ch.literal(resources.pendingOverrideSnapshotName)}`,
            )
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logError("failed to drop pending override snapshot", {
                  cause,
                  table: resources.pendingOverrideSnapshotName,
                }),
              ),
            );
        });

      const squash = Effect.fn("squash")(
        function* (input: SquashInput) {
          const startedAt = Date.now();
          const cutoffIso = computeCutoffIso({
            now: new Date(),
            safetyWindowSeconds: input.safetyWindowSeconds,
          });

          yield* Effect.annotateCurrentSpan("voidhash.janitor.batch_size", input.batchSize);
          yield* Effect.annotateCurrentSpan("voidhash.janitor.cutoff_iso", cutoffIso);

          const backlogRows = yield* selectBacklog({
            batchSize: input.batchSize,
            cutoffIso,
          }).pipe(Effect.withSpan("analytics-janitor.select-backlog"));

          yield* Effect.annotateCurrentSpan(
            "voidhash.janitor.backlog_rows_processed",
            backlogRows.length,
          );

          if (backlogRows.length === 0) {
            yield* Effect.logInfo("analytics janitor found no eligible backlog rows", {
              batchSize: input.batchSize,
              cutoffIso,
              durationMs: Date.now() - startedAt,
            });
            return {
              backlogRowsProcessed: 0,
              cutoffIso,
              durationMs: Date.now() - startedAt,
            } satisfies SquashResult;
          }

          const databaseName = yield* currentDatabaseName;
          const snapshotResources = makeSnapshotResources();

          yield* Effect.logInfo("analytics janitor selected backlog rows", {
            count: backlogRows.length,
            pendingOverrideDictionary: snapshotResources.pendingOverrideDictionaryName,
            pendingOverrideSnapshot: snapshotResources.pendingOverrideSnapshotName,
            cutoffIso,
          });

          yield* Effect.gen(function* () {
            yield* createPendingOverrideSnapshot(snapshotResources).pipe(
              Effect.withSpan("analytics-janitor.create-pending-override-snapshot"),
            );
            yield* insertPendingOverrideSnapshotRows({
              resources: snapshotResources,
              rows: backlogRows,
            }).pipe(Effect.withSpan("analytics-janitor.insert-pending-override-snapshot-rows"));
            yield* createPendingOverrideDictionary({
              databaseName,
              resources: snapshotResources,
            }).pipe(Effect.withSpan("analytics-janitor.create-pending-override-dictionary"));
            yield* updatePersonIdsFromSnapshot({
              databaseName,
              resources: snapshotResources,
            }).pipe(Effect.withSpan("analytics-janitor.update-person-ids"));
            yield* deleteSquashedBacklog({
              databaseName,
              resources: snapshotResources,
            }).pipe(Effect.withSpan("analytics-janitor.delete-backlog"));
          }).pipe(
            Effect.ensuring(
              cleanupSnapshotResources({ databaseName, resources: snapshotResources }),
            ),
          );

          const durationMs = Date.now() - startedAt;
          yield* Effect.logInfo("analytics janitor completed squash run", {
            count: backlogRows.length,
            durationMs,
          });

          return {
            backlogRowsProcessed: backlogRows.length,
            cutoffIso,
            durationMs,
          } satisfies SquashResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              SqlError: (error) =>
                Effect.fail(
                  new AnalyticsJanitorServiceError({
                    cause: error.message,
                    message: "analytics janitor squash failed",
                  }),
                ),
            }),
          ),
      );

      return { squash } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(AnalyticsJanitorService)(AnalyticsJanitorService.make);
}
