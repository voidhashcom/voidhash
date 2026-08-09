import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { AnalyticsJanitorService } from "@voidhash/core/services/analyticsIngest/AnalyticsJanitorService";
import { FxRateSync } from "@voidhash/core/workflows/definitions";
import { backendWorkflows } from "@voidhash/core/workflows/registry";
import { CronJob, CronScheduler } from "@voidhash/platform/CronScheduler";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import type { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { Config, Context, Effect, Layer } from "effect";

/** Builds the persisted jobs enabled by the current self-host configuration. */
export const makeSelfhostCronJobs = (
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
) =>
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

    if (clickhouse) {
      const janitorContext = yield* Layer.build(
        AnalyticsJanitorService.layer.pipe(Layer.provide(clickhouse)),
      );
      const janitor = Context.get(janitorContext, AnalyticsJanitorService);
      jobs.push(
        CronJob.define({
          expression: "*/5 * * * *",
          name: "analytics-janitor",
          run: () =>
            janitor.squash({ batchSize: 1000, safetyWindowSeconds: 120 }).pipe(Effect.asVoid),
        }),
      );
    }

    return jobs;
  });

/** Runs every enabled persisted cron job until the enclosing scope closes. */
export const runSelfhostCronJobs = (
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
) =>
  Effect.gen(function* () {
    const scheduler = yield* CronScheduler;
    const jobs = yield* makeSelfhostCronJobs(clickhouse);
    return yield* Effect.all(
      jobs.map((job) => scheduler.run(job, { pollIntervalMillis: 1_000 })),
      { concurrency: "unbounded" },
    );
  });
