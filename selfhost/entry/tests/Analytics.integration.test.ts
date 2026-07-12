import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import {
  Db,
  apiKeys,
  eq,
  personIdentities,
  persons,
  projects,
  sql,
} from "@voidhash/db";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  makeSelfhostAnalyticsRuntimeLive,
  runSelfhostAnalyticsConsumers,
} from "../src/backend/Analytics.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const describePg = process.env.SELFHOST_PG_TEST === "1" ? describe : describe.skip;

describePg("self-host analytics queue", () => {
  it("captures, processes, and acknowledges an event without ClickHouse", async () => {
    const config = getSelfhostRuntimeConfig();
    const suffix = crypto.randomUUID();
    const projectId = `project_capture_${suffix}`;
    const token = `vh_pk_capture_${suffix.replaceAll("-", "")}`;
    const database = Db.layer(config.database);
    const program = Effect.scoped(
      Effect.gen(function* () {
        const db = yield* Db;
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
            receivedAt: new Date(),
            requestId: `request_${suffix}`,
            sentAt: new Date(),
            token,
          },
        });
        expect(result).toEqual({ accepted: 1, rejected: 0 });

        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
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

    let count = 0;
    try {
      count = await Effect.runPromise(program);
    } finally {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
          yield* db.delete(personIdentities).where(eq(personIdentities.projectId, projectId));
          yield* db.delete(persons).where(eq(persons.projectId, projectId));
          yield* db.delete(projects).where(eq(projects.id, projectId));
          yield* db.execute(sql`
            DELETE FROM platform_queue_messages
            WHERE body_json -> 'envelope' ->> 'projectId' = ${projectId}
          `);
        }).pipe(Effect.provide(database)),
      );
    }

    expect(count).toBe(1);
  });
});
