import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Schema } from "effect";

import { PurchaseLedgerWorker } from "../../processing/application/PurchaseLedgerWorker.ts";
import { PurchaseLedgerDrain } from "./definitions.ts";

const PollResult = Schema.Struct({
  claimedCount: Schema.Number,
  deadLetteredCount: Schema.Number,
  publishedCount: Schema.Number,
  retriedCount: Schema.Number,
  staleClaimsReleased: Schema.Number,
});

/** Every-minute, bounded purchase-ledger drain registration. */
export const PurchaseLedgerDrainRegistration = WorkflowRegistration.make(PurchaseLedgerDrain, {
  dependencies: PurchaseLedgerWorker.layer,
  cron: {
    schedule: "* * * * *",
    payload: (scheduledTime) => ({ runId: scheduledTime.toISOString() }),
  },
  run: (input, ctx) =>
    Effect.gen(function* () {
      let batches = 0;
      let claimedCount = 0;
      let deadLetteredCount = 0;
      let publishedCount = 0;
      let retriedCount = 0;
      let staleClaimsReleased = 0;

      for (let index = 0; index < 10; index++) {
        const result = yield* ctx.step({
          name: `drain-${input.runId}-batch-${index}`,
          success: PollResult,
          execute: Effect.gen(function* () {
            const worker = yield* PurchaseLedgerWorker;
            return yield* worker.poll(PurchaseLedgerWorker.DEFAULT_RUN_OPTIONS);
          }),
        });

        batches++;
        claimedCount += result.claimedCount;
        deadLetteredCount += result.deadLetteredCount;
        publishedCount += result.publishedCount;
        retriedCount += result.retriedCount;
        staleClaimsReleased += result.staleClaimsReleased;
        if (result.claimedCount === 0) break;
      }

      return {
        batches,
        claimedCount,
        deadLetteredCount,
        publishedCount,
        retriedCount,
        staleClaimsReleased,
      };
    }),
});
