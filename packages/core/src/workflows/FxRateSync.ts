import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Config, Effect, Redacted, Schema } from "effect";

import { FxRateService } from "../services/fxRates/FxRateService.ts";
import { FxRateSync } from "./definitions.ts";

/** Daily foreign-exchange refresh registration. */
export const FxRateSyncRegistration = WorkflowRegistration.make(FxRateSync, {
  dependencies: FxRateService.layer({
    apiKey: Config.redacted("EXCHANGE_RATE_API_KEY").pipe(
      Config.withDefault(Redacted.make("")),
      Effect.map(Redacted.value),
      Effect.orDie,
    ),
    baseUrl: Config.string("EXCHANGE_RATE_API_BASE_URL").pipe(
      Config.withDefault("https://v6.exchangerate-api.com/v6"),
      Effect.orDie,
    ),
  }),
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
          const fxRate = yield* FxRateService;
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
