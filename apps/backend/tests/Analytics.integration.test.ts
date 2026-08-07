import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  apiKeys,
  eq,
  personIdentities,
  persons,
  projects,
  sql,
} from "@voidhash/db";
import { Clock, DateTime, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  makeSelfhostAnalyticsRuntimeLive,
  runSelfhostAnalyticsConsumers,
} from "../src/backend/Analytics.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

describe("self-host analytics queue", () => {
  it("captures, processes, and acknowledges an event without ClickHouse", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = getSelfhostRuntimeConfig();
        const suffix = generateId("test");
        const projectId = `project_capture_${suffix}`;
        const token = `vh_pk_capture_${suffix.replaceAll("-", "")}`;
        const database = Db.layer(config.database);
        const program = Effect.scoped(
          Effect.gen(function* () {
            const db = yield* Db;
            const now = yield* DateTime.nowAsDate;
            yield* db.insert(projects).values({
              id: projectId,
              name: "Capture integration",
              organizationId: `organization_${suffix}`,
              slug: `capture-${suffix}`,
            });
            yield* db.insert(apiKeys).values({
              end: token.slice(-4),
              id: `apiKey_capture_${suffix}`,
              isPublic: true,
              key: token,
              name: "Capture integration",
              prefix: "vh_pk_",
              projectId,
            });

            yield* Effect.forkScoped(runSelfhostAnalyticsConsumers(config));
            const capture = yield* EventCaptureService;
            const result = yield* capture.captureEvents({
              events: [
                {
                  context: {},
                  distinct_id: `person_${suffix}`,
                  event: "selfhost_integration",
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
            expect(result).toEqual({ accepted: 1, rejected: 0 });

            const deadline = (yield* Clock.currentTimeMillis) + 10_000;
            while ((yield* Clock.currentTimeMillis) < deadline) {
              const rows = yield* db.query.persons.findMany({ where: { projectId } });
              if (rows.length > 0) return rows.length;
              yield* Effect.sleep("25 millis");
            }
            return yield* Effect.die("analytics queue did not process the captured event");
          }).pipe(
            Effect.provide(database),
            Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
          ),
        );

        const cleanup = Effect.gen(function* () {
          const db = yield* Db;
          yield* db.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
          yield* db.delete(personIdentities).where(eq(personIdentities.projectId, projectId));
          yield* db.delete(persons).where(eq(persons.projectId, projectId));
          yield* db.delete(projects).where(eq(projects.id, projectId));
        }).pipe(Effect.provide(database), Effect.orDie);

        const cleanupQueue = Effect.gen(function* () {
          const db = yield* Db;
          // The cluster queue driver hands the store a JSON string, which the
          // store then JSON-encodes into `element`, so the body is doubly
          // encoded: unwrap the outer JSON scalar before reading its fields.
          yield* db.execute(sql`
            DELETE FROM effect_queue
            WHERE (element::jsonb #>> '{}')::jsonb -> 'envelope' ->> 'projectId' = ${projectId}
          `);
        }).pipe(Effect.provide(Db.layer(config.platformDatabase)), Effect.orDie);

        const count = yield* program.pipe(
          Effect.ensuring(cleanup),
          Effect.ensuring(cleanupQueue),
        );

        expect(count).toBe(1);
      }),
    ));
});
