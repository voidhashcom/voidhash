import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import type { PlatformRuntime, WorkflowRunner, WorkflowRunnerError } from "@voidhash/platform";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

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
      const drain = (
        index: number,
        totals: {
          readonly batches: number;
          readonly claimedCount: number;
          readonly deadLetteredCount: number;
          readonly publishedCount: number;
          readonly retriedCount: number;
          readonly staleClaimsReleased: number;
        },
      ): Effect.Effect<typeof totals, WorkflowRunnerError, PlatformRuntime | WorkflowRunner> =>
        Effect.gen(function* () {
          if (index >= 10) return totals;
          const result = yield* ctx.step({
            name: `drain-${input.runId}-batch-${index}`,
            success: PollResult,
            execute: Effect.gen(function* () {
              const worker = yield* PurchaseLedgerWorker;
              return yield* worker.poll(PurchaseLedgerWorker.DEFAULT_RUN_OPTIONS);
            }),
          });
          const next = {
            batches: totals.batches + 1,
            claimedCount: totals.claimedCount + result.claimedCount,
            deadLetteredCount: totals.deadLetteredCount + result.deadLetteredCount,
            publishedCount: totals.publishedCount + result.publishedCount,
            retriedCount: totals.retriedCount + result.retriedCount,
            staleClaimsReleased: totals.staleClaimsReleased + result.staleClaimsReleased,
          };
          if (result.claimedCount === 0) return next;
          return yield* drain(index + 1, next);
        });

      return yield* drain(0, {
        batches: 0,
        claimedCount: 0,
        deadLetteredCount: 0,
        publishedCount: 0,
        retriedCount: 0,
        staleClaimsReleased: 0,
      });
    }),
});
