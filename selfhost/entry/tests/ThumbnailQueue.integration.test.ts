import { PaywallThumbnailService } from "@voidhash/core/services/paywallThumbnails/PaywallThumbnailService";
import { Db, sql } from "@voidhash/db";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import { runSelfhostPaywallThumbnailConsumer } from "../src/backend/Thumbnails.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";
import {
  makeSelfhostMimicDocumentIdlePublisher,
  mimicDocumentIdleQueueName,
} from "../src/mimic/MimicDocumentIdleQueue.ts";

const describePg = process.env.SELFHOST_PG_TEST === "1" ? describe : describe.skip;

describePg("self-host thumbnail queue", () => {
  it("delivers and acknowledges an idle-document revision", async () => {
    const config = getSelfhostRuntimeConfig();
    const documentId = `thumbnail-${crypto.randomUUID()}`;
    const handled: Array<{ readonly documentId: string; readonly seq: number }> = [];

    try {
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const publish = yield* makeSelfhostMimicDocumentIdlePublisher;
            const service = PaywallThumbnailService.of({
              handleDocumentIdle: (input) =>
                Effect.sync(() => {
                  handled.push(input);
                }),
              forceRenderCurrent: () => Effect.succeed(false),
              renderCurrent: () => Effect.succeed(false),
            });
            yield* Effect.forkScoped(
              runSelfhostPaywallThumbnailConsumer.pipe(
                Effect.provideService(PaywallThumbnailService, service),
              ),
            );
            yield* publish({ collectionId: "collection-1", documentId, seq: 17 });

            const deadline = Date.now() + 10_000;
            while (handled.length === 0 && Date.now() < deadline) {
              yield* Effect.sleep("25 millis");
            }
          }),
        ).pipe(Effect.provide(makeSelfhostAnalyticsRuntimeLive(config))),
      );
    } finally {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.execute(sql`
            DELETE FROM platform_queue_messages
            WHERE queue_name = ${mimicDocumentIdleQueueName}
              AND body_json ->> 'documentId' = ${documentId}
          `);
        }).pipe(Effect.provide(Db.layer(config.database))),
      );
    }

    expect(handled).toEqual([{ documentId, seq: 17 }]);
  });
});
