import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import { VoidhashV1Api } from "@voidhash/api-contracts";
import { Db } from "@voidhash/db";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { Workos } from "@voidhash/core/services/auth/Workos";
import {
  AnalyticsService,
  ApiKeyService,
  AuditLogPort,
  AuthTokenVerifier,
  AppStorePaymentProvider,
  AppStorePaymentProviderEngine,
  ApplePushNotificationServiceConfigLive,
  AiChatService,
  AppStorePaymentProviderConfigLive,
  AppStorePaymentProviderServiceLive,
  AppStoreTransactionVerifier,
  ExperimentService,
  FeatureFlagService,
  FeedbackServiceLive,
  FirebaseCloudMessagingServiceConfigLive,
  FxRateService,
  GooglePlayPaymentProvider,
  GooglePlayPaymentProviderEngine,
  GooglePlayPaymentProviderConfigLive,
  GooglePlayPaymentProviderServiceLive,
  GooglePlayPurchaseVerifier,
  GooglePlayServerApi,
  IdentityProjectionPublisher,
  InternalFeatureFlagService,
  LocalUserSessionService,
  MimicHost,
  MimicHostError,
  NotificationSendingService,
  NotificationsConfigurationService,
  NotificationTokenService,
  OrganizationBillingPort,
  OrganizationMembershipSyncPort,
  OrganizationMembershipWebhookPort,
  OrganizationService,
  PaymentProviderConfigurationService,
  PaymentProviderProductService,
  PaywallAssetService,
  PersonNotificationTokenService,
  PaywallArtifactStore,
  PaywallArtifactStoreError,
  PaywallDeployService,
  PaywallLocationService,
  PaywallReleaseService,
  PaywallService,
  PaywallWorkspaceService,
  ComponentCompiler,
  ComponentManifestCacheService,
  PerkGrantService,
  PerkService,
  PersonIdentityService,
  PersonService,
  ProductPerkService,
  ProductService,
  ProjectSchemaCache,
  ProjectService,
  PublicFileStore,
  PublicFileStoreError,
  PushDeliveryDispatch,
  PushNotificationSendService,
  PurchaseProcessingService,
  PurchaseService,
  SchemaCacheInvalidationService,
  SchemaService,
  SdkService,
  StripePaymentProvider,
  StripePaymentProviderConfigLive,
  StripePaymentProviderServiceLive,
  UserService,
  VoidQlService,
  WebhookManagerService,
  WorkosLocalSyncService,
  WorkosOrgPort,
} from "@voidhash/core/services";
import { AnalyticsWriterService } from "@voidhash/core/services/analyticsIngest/AnalyticsWriterService";
import { createInitialPaywallDocumentInput, PaywallDesignerDocument } from "@voidhash/mimic-schema";
import { AuthMiddleware } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpServer from "effect/unstable/http/HttpServer";
import type * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { RpcSerialization } from "effect/unstable/rpc";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { BackendRpcGroups as RpcGroups } from "./BackendRpcGroups.ts";
import { GooglePubSubPushVerifierLive } from "./GooglePubSubPushVerifier.ts";
import { BackendSnapshotHtmlRendererLive } from "./PaywallSnapshotHtmlRenderer.ts";

import { AuthMiddlewareLive } from "./ApiMiddlewares.ts";
import { VoidhashAiError, VoidhashAiService } from "./ai/VoidhashAiService.ts";
import { AiChatRouteLayer } from "./routes/ai/chat.ts";
import { McpRouteLayer } from "./routes/mcp.ts";
import { withRequestId } from "./Telemetry.ts";
import { ApiKeysGroupLive } from "./routes/v1/api-keys.ts";
import { AuthGroupLive } from "./routes/v1/auth.ts";
import { NotificationsGroupLive } from "./routes/v1/notifications.ts";
import { OrganizationsGroupLive } from "./routes/v1/organizations.ts";
import { PaymentProviderConfigurationsGroupLive } from "./routes/v1/payment-provider-configurations.ts";
import { PaymentProviderProductsGroupLive } from "./routes/v1/payment-provider-products.ts";
import { PaywallDeploysGroupLive } from "./routes/v1/paywall-deploys.ts";
import { PaywallLocationsGroupLive } from "./routes/v1/paywall-locations.ts";
import { PerksGroupLive } from "./routes/v1/perks.ts";
import { PersonsGroupLive } from "./routes/v1/persons.ts";
import { ProductPerksGroupLive } from "./routes/v1/product-perks.ts";
import { ProductsGroupLive } from "./routes/v1/products.ts";
import { ProjectsGroupLive } from "./routes/v1/projects.ts";
import { SchemaGroupLive } from "./routes/v1/schema.ts";
import { SdkGroupLive } from "./routes/v1/sdk.ts";
import { UsersGroupLive } from "./routes/v1/users.ts";
import { WebhooksGroupLive } from "./routes/v1/webhooks.ts";
import { AppleServerToServerNotificationRouteLayer } from "./routes/webhook-endpoints/apple-server-to-server.ts";
import { GooglePlayRtdnNotificationRouteLayer } from "./routes/webhook-endpoints/google-play-rtdn.ts";
import { StripeWebhookNotificationRouteLayer } from "./routes/webhook-endpoints/stripe.ts";
import { PaywallServingRouteLayer } from "./routes/paywall-serving.ts";
import { PublicFileServingRouteLayer } from "./routes/public-file-serving.ts";
import { WorkosWebhookRouteLayer } from "./routes/webhooks/workos.ts";
import { AnalyticsRpcsLive } from "./rpcs/analytics-rpcs.ts";
import { ApiKeyRpcsLive } from "./rpcs/api-key-rpcs.ts";
import { ExperimentRpcsLive } from "./rpcs/experiment-rpcs.ts";
import { FeatureFlagRpcsLive } from "./rpcs/feature-flag-rpcs.ts";
import { FeedbackRpcsLive } from "./rpcs/feedback-rpcs.ts";
import { OrganizationRpcsLive } from "./rpcs/organization-rpcs.ts";
import { PaymentProviderConfigurationRpcsLive } from "./rpcs/payment-provider-configuration-rpcs.ts";
import { PaymentProviderProductRpcsLive } from "./rpcs/payment-provider-product-rpcs.ts";
import { PushNotificationConfigurationRpcsLive } from "./rpcs/push-notification-configuration-rpcs.ts";
import { PushNotificationSendRpcsLive } from "./rpcs/push-notification-send-rpcs.ts";
import { AiChatRpcsLive } from "./rpcs/ai-chat-rpcs.ts";
import { PaywallAssetRpcsLive } from "./rpcs/paywall-asset-rpcs.ts";
import { PaywallComponentRpcsLive } from "./rpcs/paywall-component-rpcs.ts";
import { PaywallDeployRpcsLive } from "./rpcs/paywall-deploy-rpcs.ts";
import { PaywallLocationRpcsLive } from "./rpcs/paywall-location-rpcs.ts";
import { PaywallRpcsLive } from "./rpcs/paywall-rpcs.ts";
import { PaywallWorkspaceRpcsLive } from "./rpcs/paywall-workspace-rpcs.ts";
import { PerkRpcsLive } from "./rpcs/perk-rpcs.ts";
import { PersonRpcsLive } from "./rpcs/person-rpcs.ts";
import { ProductPerkRpcsLive } from "./rpcs/product-perk-rpcs.ts";
import { ProductRpcsLive } from "./rpcs/product-rpcs.ts";
import { ProjectRpcsLive } from "./rpcs/project-rpcs.ts";
import { UserRpcsLive } from "./rpcs/user-rpcs.ts";
import { VoidQlRpcsLive } from "./rpcs/voidql-rpcs.ts";
import { WebhookRpcsLive } from "./rpcs/webhook-rpcs.ts";

/**
 * The always-on infrastructure services the route graph builds on. Declaring
 * this as a concrete union (rather than `any`) lets the type system verify that every
 * `Layer.provide` / `HttpRouter.provideRequest` in the route graph is actually
 * satisfied — without it, a missing service (e.g. the raw WorkOS webhook
 * handler's `Db`) only surfaces as a runtime "Service not found" instead of a
 * compile error. ClickHouse is deliberately not mandatory: analytics services
 * use it when the runtime's layer provides it and degrade to empty results when
 * absent. The caller's bound `InfraLayer` may be structurally wider than this
 * contract, so the cloud composition can still carry its analytics clients.
 */
export type InfraServices =
  | Db
  | Workos
  | WorkosOrgPort
  | PaywallAssetConfig
  | PaywallArtifactStore
  | PublicFileStore
  | StripePaymentProvider
  | AppStorePaymentProvider
  | GooglePlayPaymentProvider
  | IdentityProjectionPublisher
  | MimicHost
  | ComponentCompiler
  | ProjectSchemaCache;

export interface BackendRuntimeLayers<
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
> {
  readonly auth: Layer.Layer<AuthMiddleware, never, Db | LocalUserSessionService | Workos>;
  readonly infrastructure: Layer.Layer<InfraServices, never, RInfrastructure>;
  readonly features: BackendFeatureComposition<RFeatureRpcs, RFeatureServices>;
  readonly routes?: Layer.Layer<never, never, HttpRouter.HttpRouter | RInfrastructure>;
  readonly webhookManager?: Layer.Layer<WebhookManagerService, never, RInfrastructure>;
  /**
   * The hardened, single-shared `analytics_query` ClickHouse client that backs the
   * VoidQL read path (`readonly = 1` CONST profile, SELECT-only, no row policy —
   * isolation is the compiler-injected bound predicate). When omitted,
   * {@link VoidQlService} resolves the ambient (RLS readonly) client from
   * `infrastructure`, which fail-closes to empty rows because VoidQL sets no
   * `SQL_organization_id`.
   */
  readonly analyticsQueryClient?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>;
  /**
   * Queue-backed push-delivery dispatcher. Defaults to {@link PushDeliveryDispatch.noop}
   * (dev/smoke — rows are created but never delivered); the production worker
   * overrides it with the `PushDeliveryQueue` producer bound at init.
   */
  readonly pushDeliveryDispatch?: Layer.Layer<PushDeliveryDispatch>;
  /**
   * Runtime AI service implementation. Optional so the RPC smoke / dev harness
   * can omit it; platform entry points supply their provider-specific adapter.
   */
  readonly aiService?: Layer.Layer<VoidhashAiService>;
  /**
   * Token verifier used by the AI chat route (`POST /api/ai/chat`). Optional so
   * harnesses that omit the route can skip it; production entry points adapt
   * their runtime-specific token store to this port.
   */
  readonly authTokenVerifier?: AuthTokenVerifier["Service"];
  readonly rpcExtension: BackendRpcExtension<RExtensionRpcs>;
}

/**
 * Live App Store config-write provider registered under the public
 * `AppStorePaymentProvider` tag, consumed by `PaymentProviderConfigurationService`
 * and `PaymentProviderProductService` when an operator creates or updates an App
 * Store configuration. It validates the configuration against the canonical
 * schema and encrypts the secret Apple PKCS8 key on write (keyed by
 * `ENCRYPTION_KEY`; a no-op when the env var is unset). Unlike the
 * record engine (`BackendAppStorePaymentProviderServiceLive`) it needs no App
 * Store REST SDK, FX, or purchase-processing graph — only the encryption key.
 */
export const BackendAppStorePaymentProviderConfigLive = AppStorePaymentProviderConfigLive.pipe(
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

/**
 * Live Google Play config-write provider for the admin configuration and
 * product-mapping flow. It validates package/service-account configuration and
 * encrypts the service-account JSON on write; purchase ingestion remains gated
 * behind the separate Google Play record-engine work.
 */
export const BackendGooglePlayPaymentProviderConfigLive = GooglePlayPaymentProviderConfigLive.pipe(
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

/**
 * Live Stripe config-write provider for the admin configuration and revenue
 * consolidation flow. It validates account/API/webhook settings and encrypts
 * Stripe secrets on write; checkout/session creation is intentionally outside
 * this provider path.
 */
export const BackendStripePaymentProviderConfigLive = StripePaymentProviderConfigLive.pipe(
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

export const BackendPaymentProviderStubsLive = Layer.mergeAll(
  BackendStripePaymentProviderConfigLive,
  BackendAppStorePaymentProviderConfigLive,
  BackendGooglePlayPaymentProviderConfigLive,
);

/**
 * Live push delivery-provider tags (FCM + APNs), supplied at the app root EXACTLY
 * like the payment-provider config adapters: each pipes the shared
 * {@link PaymentConfigSecretCrypto} keyed by `ENCRYPTION_KEY`. In Phase 1 these
 * carry only config validation + encrypt-on-write; the `deliver` engine is gated.
 */
export const BackendFirebaseCloudMessagingServiceLive =
  FirebaseCloudMessagingServiceConfigLive.pipe(
    Layer.provide(
      PaymentConfigSecretCrypto.layer({
        key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
      }),
    ),
  );

export const BackendApplePushNotificationServiceLive = ApplePushNotificationServiceConfigLive.pipe(
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

export const BackendPushProvidersLive = Layer.mergeAll(
  BackendFirebaseCloudMessagingServiceLive,
  BackendApplePushNotificationServiceLive,
);

/**
 * Live {@link FeedbackService} for the Cloudflare backend. Reads the Slack bot
 * token and target channel from the `SLACK_BOT_TOKEN` / `SLACK_FEEDBACK_CHANNEL_ID`
 * env bindings at worker boot; `Db` is supplied by the surrounding domain-services
 * graph. Both default to empty so un-provisioned stages (dev, in-process smoke
 * tests) boot — feedback is still persisted, the Slack relay simply no-ops.
 */
export const BackendFeedbackServiceLive = FeedbackServiceLive({
  botToken: Effect.sync(() => process.env.SLACK_BOT_TOKEN ?? ""),
  defaultChannel: Effect.sync(() => process.env.SLACK_FEEDBACK_CHANNEL_ID ?? ""),
});

/**
 * Live App Store payment-provider service for the Cloudflare backend, used by
 * `SdkService` (`POST /api/v1/sdk/sync-transaction`) and the Apple
 * server-to-server webhook route. Composes the ported provider engine, webhook
 * handler, and queries (`AppStorePaymentProviderServiceLive`) with their
 * dependencies:
 *   - the App Store REST SDK over `FetchHttpClient`,
 *   - `FxRateService` for money conversion (its API key is read from the
 *     `EXCHANGE_RATE_API_KEY` env binding),
 *   - `PurchaseProcessingService` (+ its `PerkGrantService` dep) for purchase
 *     state writes.
 * `Db` and `PersonIdentityService` are supplied by the surrounding domain
 * services graph.
 */
export const BackendAppStorePaymentProviderServiceLive = AppStorePaymentProviderServiceLive.pipe(
  Layer.provide(
    AppStoreTransactionVerifier.layer.pipe(Layer.provide(AppStorePaymentProviderEngine.layer)),
  ),
  Layer.provide(AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer))),
  Layer.provide(
    FxRateService.layer({
      apiKey: Effect.sync(() => process.env.EXCHANGE_RATE_API_KEY ?? ""),
    }),
  ),
  Layer.provide(PurchaseProcessingService.layer.pipe(Layer.provide(PerkGrantService.layer))),
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

/**
 * The Google Play record-engine boundary for the Cloudflare backend. Mirrors
 * {@link BackendAppStorePaymentProviderServiceLive}: composes the public
 * `GooglePlayPaymentProviderService` (SDK path + RTDN webhook handler) with the
 * Google Play Developer API SDK over `FetchHttpClient`, `FxRateService` for
 * money conversion, `PurchaseProcessingService` (+ its `PerkGrantService` dep),
 * and `PaymentConfigSecretCrypto` for decrypting the per-tenant service-account
 * key. `Db` and `PersonIdentityService` are supplied by the surrounding domain
 * layer.
 */
export const BackendGooglePlayPaymentProviderServiceLive =
  GooglePlayPaymentProviderServiceLive.pipe(
    Layer.provide(
      GooglePlayPurchaseVerifier.layer.pipe(Layer.provide(GooglePlayPaymentProviderEngine.layer)),
    ),
    Layer.provide(GooglePlayServerApi.layer.pipe(Layer.provide(FetchHttpClient.layer))),
    Layer.provide(
      FxRateService.layer({
        apiKey: Effect.sync(() => process.env.EXCHANGE_RATE_API_KEY ?? ""),
      }),
    ),
    Layer.provide(PurchaseProcessingService.layer.pipe(Layer.provide(PerkGrantService.layer))),
    Layer.provide(
      PaymentConfigSecretCrypto.layer({
        key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
      }),
    ),
  );

/**
 * Live Stripe payment-provider record service for the Cloudflare backend, used
 * by the Stripe webhook route. Composes the record engine, webhook handler, and
 * queries (`StripePaymentProviderServiceLive`) with their dependencies:
 *   - `FetchHttpClient` for per-tenant Stripe REST calls (fee / line-item lookups),
 *   - `FxRateService` for USD conversion (`EXCHANGE_RATE_API_KEY`),
 *   - `PurchaseProcessingService` (+ `PerkGrantService`) for purchase state writes,
 *   - `PaymentConfigSecretCrypto` to decrypt the per-tenant secret + signing keys.
 * `Db` and `PersonIdentityService` are supplied by the surrounding domain graph.
 */
export const BackendStripePaymentProviderServiceLive = StripePaymentProviderServiceLive.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(
    FxRateService.layer({
      apiKey: Effect.sync(() => process.env.EXCHANGE_RATE_API_KEY ?? ""),
    }),
  ),
  Layer.provide(PurchaseProcessingService.layer.pipe(Layer.provide(PerkGrantService.layer))),
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
    }),
  ),
);

/**
 * Public URL bases for paywall release HTML:
 * - `cdnUrl` — legacy visual-editor releases, `{cdnUrl}/{s3Bucket}/{s3Key}`.
 * - `publicBaseUrl` — content-addressed code and current visual-editor releases
 *   (deploy contract §5),
 *   `{publicBaseUrl}/p/<contentHash>/...`, served by this worker's public
 *   `GET /p/:contentHash/*` route. `PAYWALL_PUBLIC_BASE_URL` is set on the
 *   worker env by `stacks/backend/workers/BackendWorker.ts` (custom domain on
 *   production/preview, pinned dev port elsewhere, overridable to front it
 *   with a CDN exposing the same layout).
 * Lazy (`Layer.sync`) so `process.env` is read at worker boot, not module
 * load.
 */
export const BackendPaywallAssetConfigLive = Layer.sync(PaywallAssetConfig, () => ({
  cdnUrl: "https://assets.voidha.sh",
  publicBaseUrl: process.env.PAYWALL_PUBLIC_BASE_URL ?? "https://api.voidhash.com",
}));

/**
 * Placeholder {@link PaywallArtifactStore} for harnesses that run the backend
 * graph outside a Cloudflare Worker (test layers, in-process RPC smoke). The
 * deployed worker provides the live R2 adapter instead
 * (`stacks/backend/infrastructure/PaywallArtifactStore.ts`). Every operation
 * fails with a stable `PaywallArtifactStoreError`, which `PaywallDeployService`
 * surfaces as a 500-style service error — deploy creation still works
 * (manifest registration is DB-only), but blob upload/finalize/serving report
 * the store as unconfigured instead of dying.
 */
export const BackendPaywallArtifactStoreStubLive = Layer.succeed(PaywallArtifactStore, {
  bucketName: "paywall-artifacts-unconfigured",
  getObject: () =>
    Effect.fail(
      new PaywallArtifactStoreError({
        cause: "unconfigured",
        message: "Paywall artifact store is not configured in this backend yet",
      }),
    ),
  head: () =>
    Effect.fail(
      new PaywallArtifactStoreError({
        cause: "unconfigured",
        message: "Paywall artifact store is not configured in this backend yet",
      }),
    ),
  putObject: () =>
    Effect.fail(
      new PaywallArtifactStoreError({
        cause: "unconfigured",
        message: "Paywall artifact store is not configured in this backend yet",
      }),
    ),
});

/**
 * Placeholder {@link PublicFileStore} for harnesses that run the backend graph
 * outside a Cloudflare Worker (test layers, in-process RPC smoke). The deployed
 * worker provides the live R2 adapter instead
 * (`stacks/backend/infrastructure/PublicFileStore.ts`). Every storage operation
 * fails with a stable `PublicFileStoreError` so avatar mutations report the
 * store as unconfigured instead of dying; URL helpers return an `.invalid` base
 * so any leaked value is obviously non-routable.
 */
export const BackendPublicFileStoreStubLive = Layer.succeed(PublicFileStore, {
  publicBaseUrl: "https://public-files-unconfigured.invalid",
  publicUrl: (key: string) => `https://public-files-unconfigured.invalid/files/${key}`,
  deleteObject: () =>
    Effect.fail(
      new PublicFileStoreError({
        cause: "unconfigured",
        message: "Public file store is not configured in this backend yet",
      }),
    ),
  getObject: () =>
    Effect.fail(
      new PublicFileStoreError({
        cause: "unconfigured",
        message: "Public file store is not configured in this backend yet",
      }),
    ),
  putObject: () =>
    Effect.fail(
      new PublicFileStoreError({
        cause: "unconfigured",
        message: "Public file store is not configured in this backend yet",
      }),
    ),
});

/**
 * Succeeding stub {@link MimicHost} for harnesses that run the backend graph
 * outside a Cloudflare Worker (test layers, in-process RPC smoke). The
 * deployed worker provides the live mimic-db adapter instead
 * (`stacks/backend/infrastructure/MimicHost.ts`). Unlike the artifact-store
 * stub above, this one succeeds with a fixed fake token so the
 * `RequestPaywallEditToken` handler chain (permission check → ensure → mint)
 * is exercised end-to-end in process.
 */
export const BackendMimicHostStubLive = Layer.succeed(MimicHost, {
  createPaywallEditToken: () =>
    Effect.sync(() => ({
      expiresAt: new Date(Date.now() + 300_000),
      token: "stub-token",
      url: "wss://stub.invalid/ws",
    })),
  ensurePaywallDocument: () => Effect.void,
  getPaywallSnapshot: () =>
    Effect.succeed(
      PaywallDesignerDocument.decode(
        PaywallDesignerDocument.encode(createInitialPaywallDocumentInput()),
      )?.[0],
    ),
  getPaywallDocument: () =>
    Effect.fail(
      new MimicHostError({
        cause: "getPaywallDocument is not available in the in-process backend harness",
        message: "mimic host document read is not stubbed",
      }),
    ),
  submitPaywallTransaction: () =>
    Effect.fail(
      new MimicHostError({
        cause: "submitPaywallTransaction is not available in the in-process backend harness",
        message: "mimic host transaction submit is not stubbed",
      }),
    ),
});

/**
 * Stub {@link ComponentCompiler} for harnesses that run the backend graph
 * outside a Node/container host: it reports `unavailable`, the same posture the
 * deployed workerd worker takes. Workspace diagnostics for component files then
 * degrade to cache-only (`unknown` on a miss); composition diagnostics still
 * validate purely. A Node-hosted harness that wants real compile diagnostics
 * provides the native-esbuild adapter instead
 * (`stacks/backend/infrastructure/ComponentCompilerNode.ts`).
 */
export const BackendComponentCompilerStubLive = Layer.succeed(ComponentCompiler, {
  compileCheck: () => Effect.succeed({ status: "unavailable" as const }),
  compileAndExtract: () => Effect.succeed({ status: "unavailable" as const }),
});

export const BackendNoopIdentityProjectionPublisherLive = IdentityProjectionPublisher.noop;

/**
 * Stub {@link VoidhashAiService} for harnesses (and dev/smoke stages) that run
 * the backend graph without an AI Gateway binding. Every `chat` call fails with
 * a stable {@link VoidhashAiError} so the route graph still builds and the
 * endpoint responds with a clear error instead of dying. Platform entry points
 * can supply a live {@link VoidhashAiService} layer.
 */
export const BackendVoidhashAiStubLive = Layer.succeed(VoidhashAiService, {
  chat: () => Effect.fail(new VoidhashAiError({ message: "AI gateway not configured" })),
});

const isAllowedCorsOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "voidhash.com" ||
      url.hostname.endsWith(".voidhash.com")
    );
  } catch {
    return false;
  }
};

const corsHeaders = (origin: string | undefined): Record<string, string> =>
  origin && isAllowedCorsOrigin(origin)
    ? {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": origin,
        vary: "Origin",
      }
    : {};

const preflightCorsHeaders = (
  origin: string | undefined,
  accessControlRequestHeaders: string | undefined,
): Record<string, string> => ({
  ...corsHeaders(origin),
  "access-control-allow-headers": accessControlRequestHeaders ?? "",
  "access-control-allow-methods": "GET, HEAD, PUT, PATCH, POST, DELETE",
  "access-control-max-age": "600",
  vary: accessControlRequestHeaders ? "Origin, Access-Control-Request-Headers" : "Origin",
});

const CorsLayer = HttpRouter.middleware(
  (httpApp) =>
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
      if (request.method === "OPTIONS") {
        return Effect.succeed(
          HttpServerResponse.empty({
            headers: preflightCorsHeaders(
              request.headers.origin,
              request.headers["access-control-request-headers"],
            ),
            status: 204,
          }),
        );
      }

      return Effect.map(httpApp, (response) =>
        HttpServerResponse.setHeaders(response, corsHeaders(request.headers.origin)),
      );
    }),
  { global: true },
);

const HealthCheckRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    yield* router.add("GET", "/api/health", HttpServerResponse.text("OK"));
    yield* router.add("GET", "/health", HttpServerResponse.text("OK"));
  }),
);

export interface BackendRuntimeCapabilities {
  readonly auditLogs: boolean;
  readonly billing: boolean;
}

const RuntimeCapabilitiesRoute = (capabilities: BackendRuntimeCapabilities) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const router = yield* HttpRouter.HttpRouter;
      yield* router.add(
        "GET",
        "/api/runtime-capabilities",
        HttpServerResponse.jsonUnsafe({
          enterprise: capabilities,
        }),
      );
    }),
  );

export type BackendCoreFeatureServices =
  | AuditLogPort
  | OrganizationBillingPort
  | OrganizationMembershipSyncPort
  | OrganizationMembershipWebhookPort;

const buildBackendFoundation = <RInfrastructure = never>(
  infrastructure: Layer.Layer<InfraServices, never, RInfrastructure>,
) => {
  const FoundationSupportServicesLayer = Layer.mergeAll(
    LocalUserSessionService.layer,
    PersonIdentityService.layer,
    SchemaCacheInvalidationService.layer,
  ).pipe(Layer.provideMerge(infrastructure));

  return { FoundationSupportServicesLayer, infrastructure };
};

export type BackendFoundationGraph<RInfrastructure = never> = ReturnType<
  typeof buildBackendFoundation<RInfrastructure>
>;

/**
 * Assembles the shared RPC handler + support/domain service graph used by both
 * the production HTTP handler ({@link buildBackendFetch}) and the in-process RPC
 * integration smoke ({@link buildBackendRpcServices}). Returns the three layers
 * the route graph is built from so neither caller has to re-derive the intricate
 * provide-ordering.
 */
const buildBackendServiceGraph = <
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
>(
  layers: Pick<
    BackendRuntimeLayers<RInfrastructure, RFeatureRpcs, RFeatureServices>,
    | "features"
    | "infrastructure"
    | "webhookManager"
    | "analyticsQueryClient"
    | "pushDeliveryDispatch"
  >,
) => {
  const RpcHandlersLayer = Layer.mergeAll(
    AiChatRpcsLive,
    AnalyticsRpcsLive,
    ApiKeyRpcsLive,
    ExperimentRpcsLive,
    FeatureFlagRpcsLive,
    FeedbackRpcsLive,
    OrganizationRpcsLive,
    PaymentProviderConfigurationRpcsLive,
    PaymentProviderProductRpcsLive,
    PushNotificationConfigurationRpcsLive,
    PushNotificationSendRpcsLive,
    PaywallAssetRpcsLive,
    PaywallComponentRpcsLive,
    PaywallDeployRpcsLive,
    PaywallLocationRpcsLive,
    PaywallRpcsLive,
    PaywallWorkspaceRpcsLive,
    PerkRpcsLive,
    PersonRpcsLive,
    ProductPerkRpcsLive,
    ProductRpcsLive,
    ProjectRpcsLive,
    UserRpcsLive,
    VoidQlRpcsLive,
    WebhookRpcsLive,
  );

  const foundation = buildBackendFoundation(layers.infrastructure);
  const FeatureSupportServicesLayer = layers.features.supportServices(foundation);

  const WorkosLocalSyncServiceLayer = WorkosLocalSyncService.layer.pipe(
    Layer.provide(foundation.FoundationSupportServicesLayer),
    Layer.provide(FeatureSupportServicesLayer),
    Layer.provide(layers.infrastructure),
  );

  const SupportServicesLayer = Layer.mergeAll(
    foundation.FoundationSupportServicesLayer,
    FeatureSupportServicesLayer,
    WorkosLocalSyncServiceLayer,
  );

  // ExperimentService depends on FeatureFlagService (its backing-flag engine),
  // provided explicitly since `mergeAll` does not cross-wire siblings. Shared
  // (memoized by layer reference) between the standalone entry below and
  // PaywallLocationService, which depends on it at serve time.
  const ExperimentServiceLayer = ExperimentService.layer.pipe(
    Layer.provide(FeatureFlagService.layer),
  );

  // VoidQL runs under the hardened single-shared `analytics_query` user when the
  // caller wires that client (Layer.provide satisfies its ClickhouseWebClient
  // before the ambient RLS readonly client is merged in); without it, it resolves
  // the ambient readonly client and fail-closes to empty rows.
  const VoidQlServiceLive = layers.analyticsQueryClient
    ? VoidQlService.layer.pipe(Layer.provide(layers.analyticsQueryClient))
    : VoidQlService.layer;

  const BaseDomainServicesLayer = Layer.mergeAll(
    AiChatService.layer,
    AnalyticsService.layer,
    ApiKeyService.layer,
    BackendFeedbackServiceLive,
    BackendAppStorePaymentProviderServiceLive,
    BackendGooglePlayPaymentProviderServiceLive,
    BackendStripePaymentProviderServiceLive,
    ExperimentServiceLayer,
    FeatureFlagService.layer,
    InternalFeatureFlagService.layer,
    // Push notifications: the per-(project, provider) config CRUD consumes the
    // two delivery-provider tags (supplied by BackendPushProvidersLive below)
    // and reads PUSH_REQUIRE_ENCRYPTION so prod fails closed on plaintext secrets.
    NotificationsConfigurationService.layer({
      requireEncryption: Effect.sync(() => process.env.PUSH_REQUIRE_ENCRYPTION === "true"),
    }),
    // Read-only send-history surface backing the "sent notifications" activity page.
    PushNotificationSendService.layer,
    PersonNotificationTokenService.layer,
    OrganizationService.layer,
    PaywallAssetService.layer,
    PaymentProviderConfigurationService.layer,
    PaymentProviderProductService.layer,
    PaywallDeployService.layer,
    PaywallLocationService.layer.pipe(Layer.provide(ExperimentServiceLayer)),
    PaywallReleaseService.layer.pipe(Layer.provide(BackendSnapshotHtmlRendererLive)),
    PaywallService.layer,
    ComponentManifestCacheService.layer,
    // The workspace service needs PaywallService (authz + slug resolution) and
    // the manifest cache; `mergeAll` does not cross-wire siblings, so both are
    // provided explicitly. MimicHost and ComponentCompiler (the headless compile
    // phase — an `unavailable` adapter in the deployed worker) come from the
    // infrastructure layer.
    PaywallWorkspaceService.layer.pipe(
      Layer.provide(PaywallService.layer),
      Layer.provide(ComponentManifestCacheService.layer),
    ),
    PerkGrantService.layer,
    PerkService.layer,
    PersonService.layer,
    ProductPerkService.layer,
    ProductService.layer,
    ProjectService.layer,
    PurchaseService.layer,
    SchemaService.layer,
    UserService.layer,
    VoidQlServiceLive,
    layers.webhookManager ?? WebhookManagerService.layer,
  ).pipe(Layer.provide(BackendPushProvidersLive), Layer.provide(SupportServicesLayer));

  // The synchronous SDK person-attribute write projects into ClickHouse via the
  // real `analyticsWriterLayer`. This is scoped to `SdkService` ONLY (provided
  // innermost so it discharges the `IdentityProjectionPublisher` requirement
  // first) — everywhere else, including `PersonIdentityService`'s own publisher
  // and the async ingest processor, keeps the no-op binding so person rows are
  // never double-written.
  const SdkIdentityProjectionPublisherLayer = IdentityProjectionPublisher.analyticsWriterLayer.pipe(
    Layer.provide(AnalyticsWriterService.layer),
    Layer.provide(layers.infrastructure),
  );

  const DomainServicesLayer = Layer.mergeAll(
    BaseDomainServicesLayer,
    SdkService.layer.pipe(
      Layer.provide(SdkIdentityProjectionPublisherLayer),
      Layer.provide(BaseDomainServicesLayer),
      Layer.provide(SupportServicesLayer),
    ),
    // The UUID seam depends on PersonNotificationTokenService (from Base) plus Db
    // and AuditLogPort (from Support); build it on top of both.
    NotificationTokenService.layer.pipe(
      Layer.provide(BaseDomainServicesLayer),
      Layer.provide(SupportServicesLayer),
    ),
    // The push send path depends on PersonNotificationTokenService (Base),
    // PersonIdentityService + Db (Support), and the queue-backed dispatcher
    // (from the worker, or the noop in dev/smoke).
    NotificationSendingService.layer.pipe(
      Layer.provide(layers.pushDeliveryDispatch ?? PushDeliveryDispatch.noop),
      Layer.provide(BaseDomainServicesLayer),
      Layer.provide(SupportServicesLayer),
    ),
  );

  return {
    DomainServicesLayer,
    FeatureSupportServicesLayer,
    RpcHandlersLayer,
    SupportServicesLayer,
  };
};

export type BackendServiceGraph<RInfrastructure = never, RFeatureServices = never> = ReturnType<
  typeof buildBackendServiceGraph<RInfrastructure, never, RFeatureServices>
>;

/** Private or enterprise RPC surface mounted by an application composition root. */
export interface BackendRpcExtension<RExtensionRpcs extends Rpc.Any> {
  readonly group: RpcGroup.RpcGroup<RExtensionRpcs>;
  readonly services: <RInfrastructure, RFeatureServices>(
    graph: BackendServiceGraph<RInfrastructure, RFeatureServices>,
  ) => Layer.Layer<
    Rpc.ToHandler<RExtensionRpcs> | Rpc.Middleware<RExtensionRpcs>,
    never,
    RInfrastructure
  >;
}

/** Product feature bundle that supplies core ports, RPCs, routes, and UI capabilities. */
export interface BackendFeatureComposition<RFeatureRpcs extends Rpc.Any, RFeatureServices> {
  readonly group: RpcGroup.RpcGroup<RFeatureRpcs>;
  readonly runtimeCapabilities: BackendRuntimeCapabilities;
  readonly routes: <RInfrastructure>(
    graph: BackendServiceGraph<RInfrastructure, RFeatureServices>,
  ) => Layer.Layer<
    never,
    never,
    HttpRouter.HttpRouter | HttpRouter.Request<string, unknown> | RInfrastructure
  >;
  readonly supportServices: <RInfrastructure>(
    foundation: BackendFoundationGraph<RInfrastructure>,
  ) => Layer.Layer<BackendCoreFeatureServices | RFeatureServices, never, RInfrastructure>;
  readonly services: <RInfrastructure>(
    graph: BackendServiceGraph<RInfrastructure, RFeatureServices>,
  ) => Layer.Layer<Rpc.ToHandler<RFeatureRpcs>, never, RInfrastructure>;
}

/** Core-only feature composition used when the enterprise source tree is absent. */
export const NoBackendFeatures: BackendFeatureComposition<never, never> = {
  group: RpcGroup.make(),
  routes: () => Layer.empty,
  runtimeCapabilities: { auditLogs: false, billing: false },
  services: () => Layer.empty,
  supportServices: () =>
    Layer.mergeAll(
      AuditLogPort.noop,
      OrganizationBillingPort.noop,
      OrganizationMembershipSyncPort.noop,
      OrganizationMembershipWebhookPort.noop,
    ),
};

/** Explicitly disables additional RPC surfaces for a backend composition root. */
export const NoBackendRpcExtension: BackendRpcExtension<never> = {
  group: RpcGroup.make(),
  services: () => Layer.empty,
};

/**
 * The RPC handlers + auth middleware, fed by the full support/domain service
 * graph — i.e. exactly the context `RpcTest.makeClient(RpcGroups)` requires
 * (`Rpc.ToHandler<RpcGroups> | AuthMiddleware`). Used by the
 * in-process integration smoke to dispatch RPCs against the real handler graph
 * without an HTTP transport. The only requirements that remain are the
 * {@link InfraServices} (provided by the caller's `infrastructure` layer) and
 * the asynchronous workflow ports the handlers resolve lazily at request time
 * (`WebhookDeliveryWorkflow`, `IdentifyDistinctIdCompletionWorkflow`,
 * `AppStoreReplayParkedNotificationsWorkflow`).
 */
export const buildBackendRpcServices = <
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
>(
  layers: Pick<
    BackendRuntimeLayers<RInfrastructure, RFeatureRpcs, RFeatureServices, RExtensionRpcs>,
    | "auth"
    | "features"
    | "infrastructure"
    | "webhookManager"
    | "analyticsQueryClient"
    | "rpcExtension"
  >,
) => {
  const graph = buildBackendServiceGraph(layers);
  const { DomainServicesLayer, RpcHandlersLayer, SupportServicesLayer } = graph;
  const FeatureServicesLayer = layers.features.services(graph);
  const ExtensionServicesLayer = layers.rpcExtension.services(graph);

  return Layer.mergeAll(
    RpcHandlersLayer,
    FeatureServicesLayer,
    ExtensionServicesLayer,
    layers.auth,
  ).pipe(Layer.provide(DomainServicesLayer), Layer.provide(SupportServicesLayer));
};

/**
 * Builds the backend HTTP handler from the same RPC/API route graph used in production.
 *
 * @internal The monorepo composition roots consume this source entry directly. The
 * inferred Effect route type exceeds TypeScript's declaration serializer limit, so
 * consumers compile this exact source signature instead of a widened declaration.
 */
export const buildBackendFetch = <
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
>(
  layers: BackendRuntimeLayers<RInfrastructure, RFeatureRpcs, RFeatureServices, RExtensionRpcs>,
) => {
  const graph = buildBackendServiceGraph(layers);
  const { DomainServicesLayer, RpcHandlersLayer, SupportServicesLayer } = graph;
  const FeatureServicesLayer = layers.features.services(graph);
  const ExtensionServicesLayer = layers.rpcExtension.services(graph);
  const RpcGroup = RpcGroups.merge(layers.features.group, layers.rpcExtension.group);

  const RpcRouteDependencies = Layer.mergeAll(
    RpcSerialization.layerNdjson,
    layers.auth,
    RpcHandlersLayer,
    FeatureServicesLayer,
    ExtensionServicesLayer,
  );

  const RpcRoutesBase = RpcServer.layerHttp({
    group: RpcGroup,
    path: "/rpc/*",
    protocol: "http",
  });

  const RpcRoutesLayer = RpcRoutesBase.pipe(
    Layer.provide(RpcRouteDependencies.pipe(Layer.provide(SupportServicesLayer))),
    Layer.provide(DomainServicesLayer),
    Layer.provide(SupportServicesLayer),
  );

  const V1GroupsLayer = Layer.mergeAll(
    ApiKeysGroupLive,
    AuthGroupLive,
    NotificationsGroupLive,
    OrganizationsGroupLive,
    PaymentProviderConfigurationsGroupLive,
    PaymentProviderProductsGroupLive,
    PaywallDeploysGroupLive,
    PaywallLocationsGroupLive,
    PerksGroupLive,
    PersonsGroupLive,
    ProductPerksGroupLive,
    ProductsGroupLive,
    ProjectsGroupLive,
    SchemaGroupLive,
    SdkGroupLive,
    UsersGroupLive,
    WebhooksGroupLive,
  );

  // Provided to every group as the per-request `AuthMiddleware` impl. Itself
  // depends on `ApiKeyService`, `LocalUserSessionService`, and `Workos` —
  // wired here so the api-contracts middleware sees a populated context.
  const HttpAuthMiddlewareLive = AuthMiddlewareLive.pipe(
    Layer.provide(DomainServicesLayer),
    Layer.provide(SupportServicesLayer),
  );

  const V1ApiRoutes = HttpApiBuilder.layer(VoidhashV1Api, {
    openapiPath: "/api/docs/openapi.json",
  }).pipe(
    Layer.provide(V1GroupsLayer),
    Layer.provide(HttpAuthMiddlewareLive),
    Layer.provide(DomainServicesLayer),
    Layer.provide(SupportServicesLayer),
  );

  // Webhook routes register raw handlers on the underlying `HttpRouter`. A raw
  // `router.add` handler's service requirements (DB + WorkOS +
  // LocalUserSessionService + OrganizationMembershipWebhookPort for the WorkOS
  // one) surface as a deferred
  // `Request.From<"Requires", …>` that resolves at request time, NOT a normal
  // layer dependency — so `Layer.provide` does not discharge it (it would
  // silently leak to the request handler and die with "Service not found").
  // `HttpRouter.provideRequest` is the combinator that satisfies these
  // request-scoped requirements. The Autumn webhook handler resolves `Db` +
  // `BillingService` at request time (both part of the merged graph below);
  // the Apple handler resolves the live public App Store service the same way;
  // the Google handler additionally resolves its Pub/Sub OIDC verifier.
  const WebhookRoutesLayer = Layer.mergeAll(
    AppleServerToServerNotificationRouteLayer,
    GooglePlayRtdnNotificationRouteLayer,
    StripeWebhookNotificationRouteLayer,
    WorkosWebhookRouteLayer,
    layers.features.routes(graph),
  ).pipe(
    HttpRouter.provideRequest(
      Layer.mergeAll(GooglePubSubPushVerifierLive, SupportServicesLayer, DomainServicesLayer),
    ),
  );

  // Public, unauthenticated serving of code-deployed paywall artifacts
  // (deploy contract §5). A raw route like the webhooks, so its request-time
  // requirement (`PaywallArtifactStore`, part of the infrastructure merged
  // into `SupportServicesLayer`) needs `HttpRouter.provideRequest`.
  const PaywallServingLayer = PaywallServingRouteLayer.pipe(
    HttpRouter.provideRequest(SupportServicesLayer),
  );

  // Public, unauthenticated serving of stored public assets (`GET /files/*`,
  // e.g. avatars). Like the paywall serving layer, its request-time requirement
  // (`PublicFileStore`, part of the infrastructure merged into
  // `SupportServicesLayer`) needs `HttpRouter.provideRequest`.
  const PublicFileServingLayer = PublicFileServingRouteLayer.pipe(
    HttpRouter.provideRequest(SupportServicesLayer),
  );

  // Voidhash AI streaming chat route (`POST /api/ai/chat`). Registered only when
  // a token verifier is available; the request-scoped requirements —
  // `VoidhashAiService` (live when supplied, else the
  // failing stub) plus `Db` / `Workos` / `LocalUserSessionService` from the
  // domain graph for session resolution — are satisfied via `provideRequest`,
  // like the webhook routes.
  const VoidhashAiServiceLayer = layers.aiService ?? BackendVoidhashAiStubLive;

  const AiRoutesLayer = layers.authTokenVerifier
    ? AiChatRouteLayer(layers.authTokenVerifier).pipe(
        // The server-executed agent tools reach the workspace/chat services via
        // `VoidhashAiService.chat`; those (plus `Db`/`Workos`/session-resolution
        // support) must be request-scoped. `AuthSession` is provided in-handler
        // from the resolved session, so the domain graph here is session-free.
        HttpRouter.provideRequest(
          Layer.mergeAll(VoidhashAiServiceLayer, DomainServicesLayer, SupportServicesLayer),
        ),
      )
    : Layer.empty;

  // MCP endpoint (`POST /api/mcp`, stateless streamable HTTP). Its request-scoped
  // requirements — `ApiKeyService` (secret-key auth) + `PaywallWorkspaceService`
  // + `AiChatService` (the shared workspace tools' context) + `Db` (key
  // validation) — are satisfied via `provideRequest` like the AI chat route.
  // `AuthSession` is provided in-handler from the validated secret key. Unlike
  // the AI chat route, MCP needs no JWT namespace (it authenticates with v1
  // secret keys), so it registers unconditionally.
  const McpRoutesLayer = McpRouteLayer.pipe(
    HttpRouter.provideRequest(Layer.mergeAll(DomainServicesLayer, SupportServicesLayer)),
  );

  const RoutesLayer = Layer.mergeAll(
    RpcRoutesLayer,
    V1ApiRoutes,
    WebhookRoutesLayer,
    PaywallServingLayer,
    PublicFileServingLayer,
    AiRoutesLayer,
    McpRoutesLayer,
    HealthCheckRoute,
    RuntimeCapabilitiesRoute(layers.features.runtimeCapabilities),
    layers.routes ?? Layer.empty,
  ).pipe(Layer.provide(CorsLayer));

  // `toHttpEffect` returns a *builder* effect that yields the per-request
  // handler (built once at init); we map over it to wrap that inner handler.
  // `HttpMiddleware.tracer` opens the per-request `server` span (reading W3C
  // `traceparent` for distributed propagation and setting standard `http.*` /
  // `url.*` attributes) and installs it as the parent of every downstream
  // `Effect.fn` span; `withRequestId` runs inside it to stamp/echo the
  // `x-request-id` correlation id. Both are no-ops under the default no-op
  // tracer (tests / dev without the OTLP layer); the real tracer is provided at
  // the Worker fetch-graph root.
  const httpAppBuilder = RoutesLayer.pipe(
    Layer.provide(HttpServer.layerServices),
    HttpRouter.toHttpEffect,
  );
  return Effect.map(httpAppBuilder, (handler) => HttpMiddleware.tracer(withRequestId(handler)));
};
