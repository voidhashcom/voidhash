import { PushDeliveryDispatch } from "@voidhash/core/services/notifications/PushDeliveryDispatch";
import { Db, sql } from "@voidhash/db";
import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import {
  runSelfhostPushDeliveryConsumers,
  SelfhostPushDeliveryDispatchLive,
} from "../src/backend/Push.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const describePg = process.env.SELFHOST_PG_TEST === "1" ? describe : describe.skip;

describePg("self-host push-delivery queue", () => {
  it("dispatches and acknowledges a delivery pointer through the consumer", async () => {
    const config = getSelfhostRuntimeConfig();
    const deliveryId = `pushDelivery_${crypto.randomUUID()}`;
    const database = Db.layer(config.database);

    const remaining = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.execute(sql`
            DELETE FROM platform_queue_messages
            WHERE body_json ->> 'pushNotificationDeliveryId' = ${deliveryId}
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

          const deadline = Date.now() + 10_000;
          while (Date.now() < deadline) {
            const rows = yield* db.execute(sql`
              SELECT COUNT(*)::integer AS total
              FROM platform_queue_messages
              WHERE body_json ->> 'pushNotificationDeliveryId' = ${deliveryId}
            `);
            const total = Number((rows[0] as { readonly total?: number } | undefined)?.total ?? 0);
            if (total === 0) return total;
            yield* Effect.sleep("25 millis");
          }
          return 1;
        }).pipe(
          Effect.provide(database),
          Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
        ),
      ),
    );

    expect(remaining).toBe(0);
  });
});
