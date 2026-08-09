import { PushDeliveryDispatch } from "@voidhash/core/services/notifications/PushDeliveryDispatch";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Db, sql } from "@voidhash/db";
import { Clock, Context, Effect, Layer, Predicate } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostPlatformLive } from "../src/backend/PlatformProfile.ts";
import {
  runSelfhostPushDeliveryConsumers,
  SelfhostPushDeliveryDispatchLive,
} from "../src/backend/Push.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

/** Reads the `total` column off an untyped SQL row. */
const totalOf = (row: unknown): number => {
  if (!Predicate.isObject(row)) return 0;
  return Number(row["total"] ?? 0);
};

describe("self-host push-delivery queue", () => {
  it("dispatches and acknowledges a delivery pointer through the consumer", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = getSelfhostRuntimeConfig();
        const deliveryId = `pushDelivery_${generateId("test")}`;

        const remaining = yield* Effect.scoped(
          Effect.gen(function* () {
            // The queue rows live in the platform database, which is a different
            // connection from the application tables the consumer reads.
            const platformContext = yield* Layer.build(Db.layer(config.platformDatabase));
            const db = Context.get(platformContext, Db);
            // The cluster queue driver hands the store a JSON string, which the
            // store then JSON-encodes into `element`, so the body is doubly
            // encoded: unwrap the outer JSON scalar before reading its fields.
            yield* db.execute(sql`
              DELETE FROM effect_queue
              WHERE (element::jsonb #>> '{}')::jsonb ->> 'pushNotificationDeliveryId' = ${deliveryId}
            `);
            const dispatchContext = yield* Layer.build(SelfhostPushDeliveryDispatchLive);
            const dispatch = Context.get(dispatchContext, PushDeliveryDispatch);
            yield* Effect.forkScoped(runSelfhostPushDeliveryConsumers(config));
            yield* dispatch.dispatch([
              {
                projectId: "project_push_integration",
                provider: "fcm",
                pushNotificationDeliveryId: deliveryId,
                pushNotificationSendId: "pushSend_integration",
              },
            ]);

            const deadline = (yield* Clock.currentTimeMillis) + 10_000;
            while ((yield* Clock.currentTimeMillis) < deadline) {
              const rows = yield* db.execute(sql`
                SELECT COUNT(*)::integer AS total
                FROM effect_queue
                WHERE completed = FALSE
                  AND (element::jsonb #>> '{}')::jsonb ->> 'pushNotificationDeliveryId' = ${deliveryId}
              `);
              const total = totalOf(rows[0]);
              if (total === 0) return total;
              yield* Effect.sleep("25 millis");
            }
            return 1;
          }).pipe(Effect.provide(makeSelfhostPlatformLive(config))),
        );

        expect(remaining).toBe(0);
      }),
    ));
});
