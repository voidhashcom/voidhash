import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Db, analyticsEvents, apiKeys, eq, projects } from "@voidhash/db";
import { DateTime, Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import { makeSelfhostPlatformLive } from "../src/backend/PlatformProfile.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

describe("self-host PostgreSQL analytics", () => {
  it("persists an allowed event before capture returns", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = getSelfhostRuntimeConfig();
        const suffix = generateId("test");
        const projectId = `project_capture_${suffix}`;
        const token = `vh_pk_capture_${suffix.replaceAll("-", "")}`;
        const database = Db.layer(config.database);

        const program = Effect.gen(function* () {
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

          const capture = yield* EventCaptureService;
          const result = yield* capture.captureEvents({
            events: [
              {
                context: {},
                distinct_id: `person_${suffix}`,
                event: "$app_opened",
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
          const rows = yield* db.query.analyticsEvents.findMany({ where: { projectId } });
          expect(rows).toHaveLength(1);
          expect(rows[0]?.eventName).toBe("$app_opened");
        }).pipe(
          Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
          Effect.provide(makeSelfhostPlatformLive(config)),
          Effect.provide(database),
        );

        const cleanup = Effect.gen(function* () {
          const db = yield* Db;
          yield* db.delete(analyticsEvents).where(eq(analyticsEvents.projectId, projectId));
          yield* db.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
          yield* db.delete(projects).where(eq(projects.id, projectId));
        }).pipe(Effect.provide(database), Effect.orDie);

        yield* program.pipe(Effect.ensuring(cleanup));
      }),
    ));
});
