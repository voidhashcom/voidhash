import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Schema } from "effect";

import { FxRates, FxRateSync } from "@voidhash/core-v2";

/** Daily foreign-exchange refresh registration. */
export const FxRateSyncRegistration = WorkflowRegistration.make(FxRateSync, {
  dependencies: FxRates.layer,
  cron: {
    schedule: "0 5 * * *",
    payload: (scheduledTime) => ({ runId: scheduledTime.toISOString() }),
  },
  run: (input, ctx) =>
    Effect.gen(function* () {
      const refreshedCount = yield* ctx.step({
        name: `refresh-latest-${input.runId}`,
        success: Schema.Number,
        execute: Effect.gen(function* () {
          const fxRate = yield* FxRates;
          return yield* fxRate.refreshLatest();
        }).pipe(
          Effect.tap((count) =>
            Effect.logInfo(`FxRateSyncWorkflow refreshed ${count} rate(s)`, input),
          ),
        ),
      });
      return { refreshedCount };
    }),
});
