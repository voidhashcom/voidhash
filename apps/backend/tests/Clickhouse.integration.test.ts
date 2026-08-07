import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "@voidhash/clickhouse-db/analytics/schema";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  apiKeys,
  Db,
  eq,
  personIdentities,
  persons,
  projects,
  sql as pgSql,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Clock, Context, Data, DateTime, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import {
  makeSelfhostAnalyticsRuntimeLive,
  runSelfhostAnalyticsConsumers,
} from "../src/backend/Analytics.ts";
import {
  makeSelfhostClickhouseLayers,
  migrateSelfhostClickhouse,
} from "../src/backend/Clickhouse.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const analyticsTables = constant([
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
]);

class MissingClickhouseConfigError extends Data.TaggedError("MissingClickhouseConfigError")<{
  readonly message: string;
}> {}

const countEvents = (
  layer: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
  projectId: string,
  organizationId?: string,
) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const query = ch<{ readonly total: string }>`
        SELECT count() AS total
        FROM ${ch.literal(CLICKHOUSE_EVENTS_TABLE)}
        WHERE project_id = ${ch.param("String", projectId)}
      `;
    if (!organizationId) {
      const rows = yield* query;
      return Number(rows[0]?.total ?? 0);
    }
    const rows = yield* ch.withClickhouseSettings(query, {
      SQL_organization_id: organizationId,
    });
    return Number(rows[0]?.total ?? 0);
  }).pipe(Effect.provide(layer), Effect.scoped);

describe("self-host ClickHouse analytics", () => {
  it("writes captured events and enforces the runtime access split", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = getSelfhostRuntimeConfig();
        const clickhouseConfig = config.clickhouse;
        if (!clickhouseConfig) {
          return yield* new MissingClickhouseConfigError({
            message: "CLICKHOUSE_URL is required for this test",
          });
        }
        yield* migrateSelfhostClickhouse(clickhouseConfig);
        const clickhouse = makeSelfhostClickhouseLayers(clickhouseConfig);
        const database = Db.layer(config.database);
        const suffix = generateId("test");
        const projectId = `project_clickhouse_${suffix}`;
        const organizationId = `organization_clickhouse_${suffix}`;
        const token = `vh_pk_clickhouse_${suffix.replaceAll("-", "")}`;

        const teardown = Effect.gen(function* () {
          yield* Effect.gen(function* () {
            const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
            yield* Effect.forEach(
              analyticsTables,
              (table) =>
                ch.asCommand(ch`
                ALTER TABLE ${ch(table)} DELETE
                WHERE project_id = ${projectId}
              `),
              { discard: true },
            );
          }).pipe(Effect.provide(clickhouse.readWrite), Effect.scoped);
          yield* Effect.gen(function* () {
            const db = yield* Db;
            yield* db.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
            yield* db.delete(personIdentities).where(eq(personIdentities.projectId, projectId));
            yield* db.delete(persons).where(eq(persons.projectId, projectId));
            yield* db.delete(projects).where(eq(projects.id, projectId));
          }).pipe(Effect.provide(database));
          yield* Effect.gen(function* () {
            const db = yield* Db;
            // The cluster queue driver hands the store a JSON string, which the
            // store then JSON-encodes into `element`, so the body is doubly
            // encoded: unwrap the outer JSON scalar before reading its fields.
            yield* db.execute(pgSql`
            DELETE FROM effect_queue
            WHERE (element::jsonb #>> '{}')::jsonb -> 'envelope' ->> 'projectId' = ${projectId}
          `);
          }).pipe(Effect.provide(Db.layer(config.platformDatabase)));
        }).pipe(Effect.orDie);

        return yield* Effect.gen(function* () {
          const written = yield* Effect.scoped(
            Effect.gen(function* () {
              const db = yield* Db;
              yield* db.insert(projects).values({
                id: projectId,
                name: "ClickHouse integration",
                organizationId,
                slug: `clickhouse-${suffix}`,
              });
              yield* db.insert(apiKeys).values({
                end: token.slice(-4),
                id: `apiKey_clickhouse_${suffix}`,
                isPublic: true,
                key: token,
                name: "ClickHouse integration",
                prefix: "vh_pk_",
                projectId,
              });

              yield* Effect.forkScoped(
                runSelfhostAnalyticsConsumers(config, clickhouse.readWrite),
              );
              const capture = yield* EventCaptureService;
              const now = yield* DateTime.nowAsDate;
              yield* capture.captureEvents({
                events: [
                  {
                    context: {},
                    distinct_id: `person_${suffix}`,
                    event: "selfhost_clickhouse_integration",
                    properties: { plan: "pro" },
                    uuid: `event_${suffix}`,
                  },
                ],
                request: {
                  headers: {},
                  path: "/i/v1/capture",
                  receivedAt: now,
                  requestId: `request_${suffix}`,
                  sentAt: now,
                  token,
                },
              });

              const readWriteContext = yield* Layer.build(clickhouse.readWrite);
              const ch = Context.get(
                readWriteContext,
                ClickhouseWebClient.ClickhouseWebClient,
              );
              const deadline = (yield* Clock.currentTimeMillis) + 10_000;
              while ((yield* Clock.currentTimeMillis) < deadline) {
                const rows = yield* ch<{ readonly total: string }>`
                SELECT count() AS total
                FROM ${ch.literal(CLICKHOUSE_EVENTS_TABLE)}
                WHERE project_id = ${ch.param("String", projectId)}
              `;
                if (Number(rows[0]?.total ?? 0) > 0) return Number(rows[0]?.total);
                yield* Effect.sleep("25 millis");
              }
              return yield* Effect.die("analytics event did not land in ClickHouse");
            }).pipe(
              Effect.provide(database),
              Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
              Effect.provide(clickhouse.readOnly),
            ),
          );

          expect(written).toBe(1);
          expect(yield* countEvents(clickhouse.readOnly, projectId, organizationId)).toBe(1);
          expect(yield* countEvents(clickhouse.readOnly, projectId, "another-organization")).toBe(
            0,
          );
          expect(yield* countEvents(clickhouse.analyticsQuery, projectId)).toBe(1);
        }).pipe(Effect.ensuring(teardown));
      }),
    ), 30_000);
});
