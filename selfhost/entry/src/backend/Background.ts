import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import { AnalyticsJanitorService } from "@voidhash/core/services/analyticsIngest/AnalyticsJanitorService";
import { FxRateService } from "@voidhash/core/services/fxRates/FxRateService";
import { APP_STORE_PARKED_SDK_TTL_DAYS } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import { AppStorePaymentProviderServiceQueries } from "@voidhash/core/services/paymentProviders/appStore/payment-provider-service-queries";
import { PurchaseLedgerWorkerService } from "@voidhash/core/services/purchaseProcessing/PurchaseLedgerWorkerService";
import { Db } from "@voidhash/db";
import {
  type CronJob,
  CronScheduler,
} from "@voidhash/platform/CronScheduler";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { PgCronSchedulerLive } from "@voidhash/platform-node/CronScheduler";
import { Context, Effect, Layer, Redacted } from "effect";

import type { SelfhostRuntimeConfig } from "../config.ts";

const dayMillis = 24 * 60 * 60 * 1000;

const postgresConfig = (config: SelfhostRuntimeConfig) => ({
  database: config.database.databaseName,
  host: config.database.host,
  password: Redacted.make(config.database.password),
  port: config.database.port,
  ...(config.database.ssl === undefined ? {} : { ssl: config.database.ssl }),
  username: config.database.username,
});

/** Builds the persisted jobs enabled by the current self-host configuration. */
export const makeSelfhostCronJobs = (
  config: SelfhostRuntimeConfig,
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
) =>
  Effect.gen(function* () {
    const dispatch = yield* AnalyticsDispatchService;
    const database = Db.layer(config.database);
    const purchaseContext = yield* Layer.build(
      PurchaseLedgerWorkerService.layer.pipe(
        Layer.provide(Layer.succeed(AnalyticsDispatchService, dispatch)),
        Layer.provide(database),
      ),
    );
    const purchaseWorker = Context.get(purchaseContext, PurchaseLedgerWorkerService);
    const appStoreContext = yield* Layer.build(
      AppStorePaymentProviderServiceQueries.layer.pipe(Layer.provide(database)),
    );
    const appStoreQueries = Context.get(
      appStoreContext,
      AppStorePaymentProviderServiceQueries,
    );
    const jobs: Array<CronJob<PlatformRuntime | Db>> = [
      {
        expression: "* * * * *",
        name: "purchase-ledger-drain",
        run: () =>
          purchaseWorker
            .poll({ batchSize: 100, maxAttempts: 8, staleClaimSeconds: 5 * 60 })
            .pipe(Effect.asVoid),
      },
      {
        expression: "0 4 * * *",
        name: "app-store-expire-parked-notifications",
        run: ({ scheduledTime }) =>
          appStoreQueries
            .expireStaleParkedSdkConfirmationRows({
              olderThan: new Date(
                scheduledTime.getTime() - APP_STORE_PARKED_SDK_TTL_DAYS * dayMillis,
              ),
            })
            .pipe(Effect.asVoid),
      },
    ];

    const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY?.trim();
    if (exchangeRateApiKey) {
      const fxContext = yield* Layer.build(
        FxRateService.layer({
          apiKey: Effect.succeed(exchangeRateApiKey),
          baseUrl: Effect.succeed(
            process.env.EXCHANGE_RATE_API_BASE_URL?.trim() ||
              "https://v6.exchangerate-api.com/v6",
          ),
        }).pipe(Layer.provide(database)),
      );
      const fxRates = Context.get(fxContext, FxRateService);
      jobs.push({
        expression: "0 5 * * *",
        name: "fx-rate-sync",
        run: () => fxRates.refreshLatest().pipe(Effect.asVoid),
      });
    }

    if (clickhouse) {
      const janitorContext = yield* Layer.build(
        AnalyticsJanitorService.layer.pipe(Layer.provide(clickhouse)),
      );
      const janitor = Context.get(janitorContext, AnalyticsJanitorService);
      jobs.push({
        expression: "*/5 * * * *",
        name: "analytics-janitor",
        run: () =>
          janitor.squash({ batchSize: 1000, safetyWindowSeconds: 120 }).pipe(Effect.asVoid),
      });
    }

    return jobs;
  });

/** Runs every enabled persisted cron job until the enclosing scope closes. */
export const runSelfhostCronJobs = (
  config: SelfhostRuntimeConfig,
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
) =>
  Effect.gen(function* () {
    const schedulerContext = yield* Layer.build(PgCronSchedulerLive(postgresConfig(config)));
    const scheduler = Context.get(schedulerContext, CronScheduler);
    const jobs = yield* makeSelfhostCronJobs(config, clickhouse);
    return yield* Effect.all(
      jobs.map((job) => scheduler.run(job, { pollIntervalMillis: 1_000 })),
      { concurrency: "unbounded" },
    );
  });
