import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { EventCaptureApi } from "@voidhash/api-contracts/event-capture";
import {
  BackendComponentCompilerStubLive,
  BackendNoopIdentityProjectionPublisherLive,
  BackendPaymentProviderStubsLive,
  BackendSnapshotImageRendererStubLive,
  NoBackendFeatures,
  NoBackendRpcExtension,
  buildBackendFetch,
} from "@voidhash/backend/BackendApp";
import {
  makeClickHouseAnalyticsLive,
  makePostgresAnalyticsLive,
  migrateClickHouseAnalytics,
} from "@voidhash/backend/analytics/AnalyticsLive";
import {
  DbFxRateStoreLive,
  DbPurchaseLedgerStoreLive,
  DbPurchaseStateStoreLive,
  ExchangeRateSourceLive,
} from "@voidhash/backend/purchases/PurchasesLive";
import { makeMimicHostLive } from "@voidhash/backend/MimicHostLive";
import { RpcAuthLive } from "@voidhash/backend/RpcMiddlewares";
import { EventCaptureGroupLive } from "@voidhash/backend/routes/event-capture";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import {
  StandaloneAuthTokenVerifierLive,
  StandaloneIdentityProviderLive,
} from "@voidhash/core/services/auth/StandaloneIdentityProvider";
import { StandaloneOrgDirectoryLive } from "@voidhash/core/services/organizations/StandaloneOrgDirectory";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { backendWorkflows } from "@voidhash/backend/purchases/workflows/registry";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as MemoryWorkflowRunner from "@voidhash/platform/MemoryWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { DbFromContextLive, HyperdriveDbLayer } from "@voidhash/platform-cloudflare/HyperdriveDb";
import { providePlatformRuntime } from "@voidhash/platform-cloudflare/PlatformRuntime";
import * as CloudflareWorkflowRunner from "@voidhash/platform-cloudflare/WorkflowRunner";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { DatabaseHyperdrive } from "../infrastructure/Hyperdrive.ts";
import {
  CommunityBackendDomain,
  CommunityWorkersDevEnabled,
} from "../infrastructure/DeploymentConfig.ts";
import { makePaywallArtifactStoreLive } from "../infrastructure/PaywallArtifactStore.ts";
import { makePublicFileStoreLive } from "../infrastructure/PublicFileStore.ts";
import { ProjectSchemaCacheLive } from "../infrastructure/ProjectSchemaCache.ts";
import { PaywallArtifactsBucket } from "../r2/PaywallArtifactsBucket.ts";
import { PublicFileStorageBucket } from "../r2/PublicFileStorageBucket.ts";

const backendDeployment = Effect.gen(function* () {
  const planContext = Option.getOrUndefined(yield* Effect.serviceOption(Alchemy.AlchemyContext));
  const dev = planContext?.dev === true;
  const configuredDomain = yield* CommunityBackendDomain;
  const domain: string | undefined = Match.value(dev).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => configuredDomain),
  );

  return {
    domain,
    publicBaseUrl: Option.match(Option.fromNullishOr(domain), {
      onNone: () =>
        Match.value(dev).pipe(
          Match.when(true, () => "http://localhost:8787"),
          Match.orElse(() => undefined),
        ),
      onSome: (value) => `https://${value}`,
    }),
  };
}).pipe(Effect.orDie);

const paywallPublicBaseUrl = (fallback: Effect.Effect<string | undefined>) =>
  Effect.flatMap(fallback, (value) => {
    const configured = Config.string("PAYWALL_PUBLIC_BASE_URL");
    return Option.match(Option.fromNullishOr(value), {
      onNone: () => configured,
      onSome: (fallbackValue) => configured.pipe(Config.withDefault(fallbackValue)),
    });
  }).pipe(Effect.orDie);

const AnalyticsStorage = Config.literals(["postgres", "clickhouse"], "ANALYTICS_STORAGE").pipe(
  Config.withDefault("postgres"),
);

const analyticsLiveFromConfig = Effect.gen(function* () {
  if ((yield* AnalyticsStorage) === "postgres") return makePostgresAnalyticsLive();
  const config = {
    database: yield* Config.string("ANALYTICS_CLICKHOUSE_DATABASE").pipe(
      Config.withDefault("default"),
    ),
    password: Redacted.value(
      yield* Config.redacted("ANALYTICS_CLICKHOUSE_PASSWORD").pipe(
        Config.withDefault(Redacted.make("")),
      ),
    ),
    url: yield* Config.string("ANALYTICS_CLICKHOUSE_URL").pipe(
      Config.withDefault("http://localhost:8123"),
    ),
    username: yield* Config.string("ANALYTICS_CLICKHOUSE_USERNAME").pipe(
      Config.withDefault("default"),
    ),
  };
  yield* migrateClickHouseAnalytics(config).pipe(Effect.orDie);
  return makeClickHouseAnalyticsLive(config);
});

const workerEnvironment = (publicBaseUrl: Effect.Effect<string | undefined>) => ({
  ANALYTICS_CLICKHOUSE_DATABASE: Config.string("ANALYTICS_CLICKHOUSE_DATABASE").pipe(
    Config.withDefault("default"),
  ),
  ANALYTICS_CLICKHOUSE_PASSWORD: Config.redacted("ANALYTICS_CLICKHOUSE_PASSWORD").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  ANALYTICS_CLICKHOUSE_URL: Config.string("ANALYTICS_CLICKHOUSE_URL").pipe(
    Config.withDefault("http://localhost:8123"),
  ),
  ANALYTICS_CLICKHOUSE_USERNAME: Config.string("ANALYTICS_CLICKHOUSE_USERNAME").pipe(
    Config.withDefault("default"),
  ),
  ANALYTICS_STORAGE: AnalyticsStorage,
  APNS_DELIVERY_ENABLED: Config.string("APNS_DELIVERY_ENABLED").pipe(Config.withDefault("false")),
  ENCRYPTION_KEY: Config.redacted("ENCRYPTION_KEY").pipe(Config.withDefault(Redacted.make(""))),
  EXCHANGE_RATE_API_KEY: Config.redacted("EXCHANGE_RATE_API_KEY").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  GOOGLE_PUBSUB_PUSH_AUDIENCE: Config.string("GOOGLE_PUBSUB_PUSH_AUDIENCE").pipe(
    Config.withDefault(""),
  ),
  GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL: Config.string(
    "GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL",
  ).pipe(Config.withDefault("")),
  PAYWALL_PUBLIC_BASE_URL: paywallPublicBaseUrl(publicBaseUrl),
  PUSH_REQUIRE_ENCRYPTION: Config.string("PUSH_REQUIRE_ENCRYPTION").pipe(
    Config.withDefault("true"),
  ),
  SLACK_BOT_TOKEN: Config.redacted("SLACK_BOT_TOKEN").pipe(Config.withDefault(Redacted.make(""))),
  SLACK_FEEDBACK_CHANNEL_ID: Config.string("SLACK_FEEDBACK_CHANNEL_ID").pipe(
    Config.withDefault(""),
  ),
  VOIDHASH_AUTH_SECRET: Config.redacted("VOIDHASH_AUTH_SECRET"),
});

/**
 * Community backend Worker composed from the portable application services and
 * Cloudflare platform adapters.
 */
export default Cloudflare.Worker(
  "CommunityBackend",
  {
    main: import.meta.filename,
    domain: backendDeployment.pipe(Effect.map(({ domain }) => domain)),
    workersDev: {
      enabled: CommunityWorkersDevEnabled,
      previewsEnabled: false,
    },
    compatibility: { date: "2026-03-17", flags: ["nodejs_compat"] },
    dev: { host: "0.0.0.0", port: 8787, strictPort: true },
    env: workerEnvironment(
      backendDeployment.pipe(Effect.map(({ publicBaseUrl }) => publicBaseUrl)),
    ),
  },
  Effect.gen(function* () {
    const planContext = Option.getOrUndefined(yield* Effect.serviceOption(Alchemy.AlchemyContext));
    const environment = Option.getOrUndefined(
      yield* Effect.serviceOption(Cloudflare.WorkerEnvironment),
    );
    const runtimeContext = yield* RuntimeContext;
    const isDev =
      planContext?.dev ?? (environment === undefined || !("DeliverWebhookWorkflow" in environment));

    const authSecret = Redacted.value(
      yield* Config.redacted("VOIDHASH_AUTH_SECRET").pipe(Effect.orDie),
    );
    const authContext = yield* Layer.build(StandaloneAuthTokenVerifierLive(authSecret));
    const authTokenVerifier = Context.get(authContext, AuthTokenVerifier);
    const dbConnection = yield* Cloudflare.Hyperdrive.Connect(DatabaseHyperdrive);
    const AnalyticsLive = yield* analyticsLiveFromConfig;

    const artifactStore = yield* makePaywallArtifactStoreLive(yield* PaywallArtifactsBucket);
    const publicBaseUrl = yield* Config.string("PAYWALL_PUBLIC_BASE_URL").pipe(
      Config.withDefault("http://localhost:8787"),
      Effect.orDie,
    );
    const publicFileStore = yield* makePublicFileStoreLive(
      yield* PublicFileStorageBucket,
      publicBaseUrl,
    );

    const workflowRunnerLayer = Match.value(isDev).pipe(
      Match.when(true, () => MemoryWorkflowRunner.layer),
      Match.orElse(() => CloudflareWorkflowRunner.layer),
    );
    const workflowRunnerContext = yield* Layer.build(
      workflowRunnerLayer.pipe(Layer.provide(Layer.succeed(RuntimeContext, runtimeContext))),
    );
    const workflowRunner = Context.get(workflowRunnerContext, WorkflowRunner);
    const workflowRuntime = Layer.mergeAll(
      Layer.succeed(WorkflowRunner, workflowRunner),
      Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
    );

    const workflowDb = HyperdriveDbLayer.make(dbConnection).pipe(
      Layer.provide(Layer.succeed(RuntimeContext, runtimeContext)),
    );
    const workflowAnalytics = AnalyticsLive.pipe(
      Layer.provide(PersonIdentityService.layer),
      Layer.provide(BackendNoopIdentityProjectionPublisherLive),
      Layer.provide(workflowDb),
    );
    const workflowPurchaseLedger = DbPurchaseLedgerStoreLive.pipe(Layer.provide(workflowDb));
    const workflowPurchaseState = DbPurchaseStateStoreLive.pipe(Layer.provide(workflowDb));
    const workflowFxRates = Layer.merge(
      DbFxRateStoreLive.pipe(Layer.provide(workflowDb)),
      ExchangeRateSourceLive({
        apiKey: Config.redacted("EXCHANGE_RATE_API_KEY").pipe(
          Config.withDefault(Redacted.make("")),
          Effect.map(Redacted.value),
          Effect.orDie,
        ),
      }).pipe(Layer.provide(FetchHttpClient.layer)),
    );
    const workflowInfrastructure = Layer.mergeAll(
      workflowDb,
      workflowAnalytics,
      workflowFxRates,
      workflowPurchaseLedger,
      workflowPurchaseState,
    );

    yield* Effect.forEach(
      backendWorkflows,
      (registration) => registration.register(workflowInfrastructure),
      { discard: true },
    ).pipe(Effect.provide(workflowRuntime), Effect.orDie);

    if (!isDev) {
      yield* Effect.forEach(
        backendWorkflows,
        (registration) => {
          if (registration.cron === undefined) return Effect.void;
          return Cloudflare.cron(registration.cron.schedule, (controller) =>
            registration
              .cron!.dispatch(DateTime.toDateUtc(DateTime.makeUnsafe(controller.scheduledTime)))
              .pipe(Effect.provide(workflowRuntime)),
          );
        },
        { discard: true },
      );
    }

    const identity = StandaloneIdentityProviderLive(authSecret);
    const directory = StandaloneOrgDirectoryLive.pipe(Layer.provide(DbFromContextLive));
    const paywallAssets = Layer.succeed(PaywallAssetConfig, {
      cdnUrl: publicBaseUrl,
      publicBaseUrl,
    });
    const infrastructure = Layer.mergeAll(
      DbFromContextLive,
      identity,
      directory,
      paywallAssets,
      artifactStore,
      publicFileStore,
      BackendPaymentProviderStubsLive,
      BackendNoopIdentityProjectionPublisherLive,
      makeMimicHostLive(environment),
      BackendComponentCompilerStubLive,
      BackendSnapshotImageRendererStubLive,
      ProjectSchemaCacheLive,
    );

    const requestInfrastructure = Layer.mergeAll(
      workflowRuntime,
      HyperdriveDbLayer.make(dbConnection),
    );

    const captureHandler = HttpApiBuilder.layer(EventCaptureApi, {
      openapiPath: "/i/docs/openapi.json",
    }).pipe(
      Layer.provide(EventCaptureGroupLive),
      Layer.provide(
        AnalyticsLive.pipe(
          Layer.provide(PersonIdentityService.layer),
          Layer.provide(BackendNoopIdentityProjectionPublisherLive),
        ),
      ),
      Layer.provide(HttpServer.layerServices),
      HttpRouter.toHttpEffect,
      Effect.flatMap((handler) => handler),
    );

    // Build scoped connections in the ambient request scope so a streaming
    // response retains them until its body closes.
    const captureFetch = Effect.gen(function* () {
      const requestContext = yield* Layer.build(requestInfrastructure);
      return yield* captureHandler.pipe(Effect.provide(requestContext));
    });

    const backendFetch = Effect.gen(function* () {
      const requestContext = yield* Layer.build(requestInfrastructure);
      return yield* Effect.gen(function* () {
        const handler = yield* buildBackendFetch({
          analytics: AnalyticsLive,
          auth: RpcAuthLive(authTokenVerifier),
          features: NoBackendFeatures,
          infrastructure,
          rpcExtension: NoBackendRpcExtension,
        });
        return yield* handler;
      }).pipe(Effect.provide(requestContext));
    });

    const routedFetch = Effect.gen(function* () {
      const request = yield* Cloudflare.Request;
      const pathname = new URL(request.url).pathname;
      if (pathname === "/i" || pathname.startsWith("/i/")) {
        return yield* captureFetch;
      }
      return yield* backendFetch;
    });

    const fetch = routedFetch.pipe(
      providePlatformRuntime,
      Effect.provideService(RuntimeContext, runtimeContext),
      Effect.catchCause((cause) =>
        Effect.logError(`Community backend request failed: ${Cause.pretty(cause)}`).pipe(
          Effect.as(HttpServerResponse.text("Internal Server Error", { status: 500 })),
        ),
      ),
    );

    return { fetch };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Cloudflare.CronEventSourceLive,
        Cloudflare.Hyperdrive.ConnectBinding,
        Cloudflare.R2.ReadWriteBucketBinding,
      ),
    ),
  ),
);
