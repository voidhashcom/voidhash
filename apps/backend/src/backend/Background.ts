import { FxRateSync } from "@voidhash/core/workflows/definitions";
import { backendWorkflows } from "@voidhash/core/workflows/registry";
import { CronJob, CronScheduler } from "@voidhash/platform/CronScheduler";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import type { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { Config, Effect } from "effect";

/** Builds the persisted jobs enabled by the current self-host configuration. */
export const makeSelfhostCronJobs =
  Effect.gen(function* () {
    const exchangeRateApiKey = (yield* Config.string("EXCHANGE_RATE_API_KEY").pipe(
      Config.withDefault(""),
      Effect.orDie,
    )).trim();
    const jobs: Array<CronJob<PlatformRuntime | WorkflowRunner>> = backendWorkflows.flatMap(
      (registration) => {
        if (registration.cron === undefined) return [];
        if (registration.workflow === FxRateSync && !exchangeRateApiKey) return [];
        return [
          CronJob.define({
            expression: registration.cron.schedule,
            name: registration.workflow.name,
            run: ({ scheduledTime }) => registration.cron!.dispatch(scheduledTime),
          }),
        ];
      },
    );

    return jobs;
  });

/** Runs every enabled persisted cron job until the enclosing scope closes. */
export const runSelfhostCronJobs =
  Effect.gen(function* () {
    const scheduler = yield* CronScheduler;
    const jobs = yield* makeSelfhostCronJobs;
    return yield* Effect.all(
      jobs.map((job) => scheduler.run(job, { pollIntervalMillis: 1_000 })),
      { concurrency: "unbounded" },
    );
  });
