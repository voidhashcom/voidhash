import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import { VoidhashV1Api } from "@voidhash/api-contracts";
import { Db } from "@voidhash/db";
import {
  AnalyticsDelivery,
  AnalyticsQuery,
  AppStorePaymentProvider,
  GooglePlayPaymentProvider,
  StripePaymentProvider,
} from "@voidhash/core-v2";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { IdentityProvider } from "@voidhash/core/services/auth/IdentityProvider";
import {
  ApiKeyService,
  AuditLogPort,
  ApplePushNotificationServiceConfigLive,
  AgentSessionIndexService,
  AgentAttachmentService,
  ExperimentService,
  FeatureFlagService,
  FeedbackServiceLive,
  FirebaseCloudMessagingServiceConfigLive,
  IdentityProjectionPublisher,
  InternalFeatureFlagService,
  LocalUserSessionService,
  MimicHost,
  MimicHostError,
  NotificationSendingService,
  NotificationsConfigurationService,
  NotificationTokenService,
  OrganizationLifecyclePort,
  OrganizationMembershipSyncPort,
  OrganizationMembershipWebhookPort,
  OrganizationService,
  PaywallAssetService,
  PersonNotificationTokenService,
  PaywallArtifactStore,
  PaywallArtifactStoreError,
  PaywallDeployService,
  PaywallEditSessionService,
  PaywallLocationService,
  PaywallReleaseService,
  PaywallService,
  PaywallThumbnailService,
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
  SnapshotImageRenderer,
  SnapshotImageRenderError,
  PushDeliveryDispatch,
  PushNotificationSendService,
  SchemaCacheInvalidationService,
  SchemaService,
  SdkService,
  UserService,
  WebhookManagerService,
  IdentityLinkBackfillService,
  OrgDirectoryPort,
} from "@voidhash/core/services";
import { createInitialPaywallDocumentInput, PaywallDesignerDocument } from "@voidhash/mimic-schema";
import { AuthMiddleware } from "@voidhash/rpc";
import { constant } from "@voidhash/lib/lang";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
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
import { makePostgresAnalyticsLive } from "./analytics/AnalyticsLive.ts";
import { EventAdmissionService } from "./analytics/EventAdmissionService.ts";
import {
  PurchaseProcessingLive,
  PurchaseQueryLive,
  PaymentProviderManagementLive,
  makeFxRatesLive,
} from "./purchases/PurchasesLive.ts";
import { AppStorePaymentProviderConfigLive } from "./purchases/providers/app-store/config-provider.ts";
import { AppStorePaymentProvider as AppStorePaymentProviderEngine } from "./purchases/providers/app-store/payment-provider.ts";
import { AppStorePaymentProviderServiceLive } from "./purchases/providers/app-store/payment-provider-service.ts";
import { AppStoreTransactionVerifier } from "./purchases/providers/app-store/transaction-verifier.ts";
import { DevelopmentPaymentProviderService } from "./purchases/providers/development/DevelopmentPaymentProviderService.ts";
import { GooglePlayPaymentProviderConfigLive } from "./purchases/providers/google-play/config-provider.ts";
import { GooglePlayPaymentProvider as GooglePlayPaymentProviderEngine } from "./purchases/providers/google-play/payment-provider.ts";
import { GooglePlayPaymentProviderServiceLive } from "./purchases/providers/google-play/payment-provider-service.ts";
import { GooglePlayPurchaseVerifier } from "./purchases/providers/google-play/purchase-verifier.ts";
import { GooglePlayServerApi } from "./purchases/providers/google-play/sdk-context.ts";
import { StripePaymentProviderConfigLive } from "./purchases/providers/stripe/config-provider.ts";
import { StripePaymentProviderServiceLive } from "./purchases/providers/stripe/payment-provider-service.ts";

import { AuthMiddlewareLive } from "./ApiMiddlewares.ts";
import { McpRouteLayer } from "./routes/mcp.ts";
import { McpOAuthRouteLayer } from "./routes/mcp-oauth.ts";
import { McpOAuth, McpOAuthUnconfiguredLive } from "./McpOAuth.ts";
import { withRequestId } from "./Telemetry.ts";
import { AnalyticsGroupLive } from "./routes/v1/analytics.ts";
import { ApiKeysGroupLive } from "./routes/v1/api-keys.ts";
import { AuthGroupLive } from "./routes/v1/auth.ts";
import { DevelopmentGroupLive } from "./routes/v1/development.ts";
import { EventsGroupLive } from "./routes/v1/events.ts";
import { ExperimentsGroupLive } from "./routes/v1/experiments.ts";
import {
  FeatureFlagOverridesGroupLive,
  FeatureFlagTargetsGroupLive,
  FeatureFlagsGroupLive,
} from "./routes/v1/feature-flags.ts";
import { IngestPolicyGroupLive } from "./routes/v1/ingest-policy.ts";
import { NotificationSendsGroupLive, NotificationsGroupLive } from "./routes/v1/notifications.ts";
import { OrganizationsGroupLive } from "./routes/v1/organizations.ts";
import { PaymentProviderConfigurationsGroupLive } from "./routes/v1/payment-provider-configurations.ts";
import { PaymentProviderProductsGroupLive } from "./routes/v1/payment-provider-products.ts";
import { PaywallDeploysGroupLive } from "./routes/v1/paywall-deploys.ts";
import { PaywallLocationsGroupLive } from "./routes/v1/paywall-locations.ts";
import { PaywallsGroupLive } from "./routes/v1/paywalls.ts";
import { PerksGroupLive } from "./routes/v1/perks.ts";
import { PersonsGroupLive } from "./routes/v1/persons.ts";
import { ProductsGroupLive } from "./routes/v1/products.ts";
import { ProjectsGroupLive } from "./routes/v1/projects.ts";
import { PushNotificationConfigurationsGroupLive } from "./routes/v1/push-notification-configurations.ts";
import { SchemaGroupLive } from "./routes/v1/schema.ts";
import { SdkGroupLive } from "./routes/v1/sdk.ts";
import { UsersGroupLive } from "./routes/v1/users.ts";
import { WebhooksGroupLive } from "./routes/v1/webhooks.ts";
import { InboundWebhookRoutesLayer } from "./routes/webhook-endpoints/index.ts";
import { PaywallServingRouteLayer } from "./routes/paywall-serving.ts";
import { PublicFileServingRouteLayer } from "./routes/public-file-serving.ts";
import { AnalyticsRpcsLive } from "./rpcs/analytics-rpcs.ts";
import { DevelopmentModeRpcsLive } from "./rpcs/development-mode-rpcs.ts";
import { ApiKeyRpcsLive } from "./rpcs/api-key-rpcs.ts";
import { EventAdmissionRpcsLive } from "./rpcs/event-admission-rpcs.ts";
import { ExperimentRpcsLive } from "./rpcs/experiment-rpcs.ts";
import { FeatureFlagRpcsLive } from "./rpcs/feature-flag-rpcs.ts";
import { FeedbackRpcsLive } from "./rpcs/feedback-rpcs.ts";
import { OrganizationRpcsLive } from "./rpcs/organization-rpcs.ts";
import { PaymentProviderConfigurationRpcsLive } from "./rpcs/payment-provider-configuration-rpcs.ts";
import { PaymentProviderProductRpcsLive } from "./rpcs/payment-provider-product-rpcs.ts";
import { PushNotificationConfigurationRpcsLive } from "./rpcs/push-notification-configuration-rpcs.ts";
import { PushNotificationSendRpcsLive } from "./rpcs/push-notification-send-rpcs.ts";
import { AgentSessionRpcsLive } from "./rpcs/agent-session-rpcs.ts";
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
import { WebhookRpcsLive } from "./rpcs/webhook-rpcs.ts";
import * as Schema from "effect/Schema";

/**
 * The always-on infrastructure services the route graph builds on. Declaring
 * this as a concrete union (rather than `any`) lets the type system verify that every
 * `Layer.provide` / `HttpRouter.provideRequest` in the route graph is actually
 * satisfied — without it, a missing service (e.g. the raw WorkOS webhook
 * handler's `Db`) only surfaces as a runtime "Service not found" instead of a
 * compile error. Analytics storage is supplied through service layers, so the
 * infrastructure contract remains database-agnostic.
 */
export type InfraServices =
  | Db
  | IdentityProvider
  | OrgDirectoryPort
  | PaywallAssetConfig
  | PaywallArtifactStore
  | PublicFileStore
  | StripePaymentProvider
  | AppStorePaymentProvider
  | GooglePlayPaymentProvider
  | IdentityProjectionPublisher
  | MimicHost
  | ComponentCompiler
  | SnapshotImageRenderer
  | ProjectSchemaCache;

export interface BackendRuntimeLayers<
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
> {
  readonly auth: Layer.Layer<
    AuthMiddleware,
    never,
    ApiKeyService | Db | IdentityProvider | LocalUserSessionService
  >;
  /**
   * Raw routes contributed by the composition root, mounted alongside the
   * built-in webhook receivers and given the same request-scoped access to the
   * domain and support services. The hosted composition mounts its identity
   * provider's webhook receiver here; self-host passes nothing.
   */
  readonly routeExtension?: Layer.Layer<
    never,
    never,
    HttpRouter.HttpRouter | HttpRouter.Request<string, unknown>
  >;
  /**
   * OAuth authorization server backing MCP bearer tokens. Defaults to
   * {@link McpOAuthUnconfiguredLive}, leaving project secret keys and user API
   * keys as the supported MCP credentials.
   */
  readonly mcpOAuth?: Layer.Layer<McpOAuth>;
  readonly infrastructure: Layer.Layer<InfraServices, never, RInfrastructure>;
  /** Overrides the community PostgreSQL analytics runtime for hosted deployments. */
  readonly analytics?: Layer.Layer<
    AnalyticsDelivery | AnalyticsQuery,
    never,
    RInfrastructure | Db | PersonIdentityService
  >;
  /**
   * Overrides the event-admission service so hosted runtimes resolve the cloud
   * registry defaults (all built-ins on) instead of the self-hosted ones.
   */
  readonly eventAdmission?: Layer.Layer<EventAdmissionService, never, RInfrastructure>;
  readonly features: BackendFeatureComposition<RFeatureRpcs, RFeatureServices>;
  readonly routes?: Layer.Layer<never, never, HttpRouter.HttpRouter | RInfrastructure>;
  readonly webhookManager?: Layer.Layer<WebhookManagerService, never, RInfrastructure>;
  /**
   * Queue-backed push-delivery dispatcher. Defaults to {@link PushDeliveryDispatch.noop}
   * (dev/smoke — rows are created but never delivered); the production worker
   * overrides it with the `PushDeliveryQueue` producer bound at init.
   */
  readonly pushDeliveryDispatch?: Layer.Layer<PushDeliveryDispatch>;
  readonly rpcExtension: BackendRpcExtension<RExtensionRpcs>;
}

/**
 * Reads an optional string env binding when the surrounding layer is built (not
 * at module load), defaulting to `fallback` when the binding is unset.
 */
const envString = (name: string, fallback = "") =>
  Config.string(name).pipe(Config.withDefault(fallback), Effect.orDie);

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
      key: envString("ENCRYPTION_KEY"),
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
      key: envString("ENCRYPTION_KEY"),
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
      key: envString("ENCRYPTION_KEY"),
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
        key: envString("ENCRYPTION_KEY"),
      }),
    ),
  );

export const BackendApplePushNotificationServiceLive = ApplePushNotificationServiceConfigLive.pipe(
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: envString("ENCRYPTION_KEY"),
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
  botToken: envString("SLACK_BOT_TOKEN"),
  defaultChannel: envString("SLACK_FEEDBACK_CHANNEL_ID"),
});

const BackendPurchasesLive = PurchaseProcessingLive;

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
  Layer.provide(AppStorePaymentProviderEngine.layer),
  Layer.provide(AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer))),
  Layer.provide(
    makeFxRatesLive({
      apiKey: envString("EXCHANGE_RATE_API_KEY"),
    }).pipe(Layer.provide(FetchHttpClient.layer)),
  ),
  Layer.provide(BackendPurchasesLive),
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: envString("ENCRYPTION_KEY"),
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
    Layer.provide(GooglePlayPaymentProviderEngine.layer),
    Layer.provide(GooglePlayServerApi.layer.pipe(Layer.provide(FetchHttpClient.layer))),
    Layer.provide(
      makeFxRatesLive({
        apiKey: envString("EXCHANGE_RATE_API_KEY"),
      }).pipe(Layer.provide(FetchHttpClient.layer)),
    ),
    Layer.provide(BackendPurchasesLive),
    Layer.provide(
      PaymentConfigSecretCrypto.layer({
        key: envString("ENCRYPTION_KEY"),
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
    makeFxRatesLive({
      apiKey: envString("EXCHANGE_RATE_API_KEY"),
    }).pipe(Layer.provide(FetchHttpClient.layer)),
  ),
  Layer.provide(BackendPurchasesLive),
  Layer.provide(
    PaymentConfigSecretCrypto.layer({
      key: envString("ENCRYPTION_KEY"),
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
 * Lazy (`Layer.effect`) so the env binding is read at worker boot, not module
 * load.
 */
export const BackendPaywallAssetConfigLive = Layer.effect(
  PaywallAssetConfig,
  Effect.gen(function* () {
    const publicBaseUrl = yield* envString("PAYWALL_PUBLIC_BASE_URL", "https://api.voidhash.com");
    return {
      cdnUrl: "https://assets.voidha.sh",
      publicBaseUrl,
    };
  }),
);

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
 * deployed worker provides the live mimic-db adapter instead. Unlike the
 * artifact-store stub above, this one succeeds with a fixed fake token so the
 * `RequestPaywallEditToken` handler chain (permission check → ensure → mint)
 * is exercised end-to-end in process.
 */
export const BackendMimicHostStubLive = Layer.succeed(MimicHost, {
  closePaywallConnection: () => Effect.void,
  createPaywallEditToken: () =>
    Effect.fn("createPaywallEditToken")(function* () {
      const now = yield* DateTime.now;
      return {
        expiresAt: DateTime.toDateUtc(DateTime.addDuration(now, "5 minutes")),
        token: "stub-token",
        url: "wss://stub.invalid/ws",
      };
    })(),
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
  getConnectedPaywallDocument: () =>
    Effect.fail(
      new MimicHostError({
        cause: "connected document reads are not available in the in-process backend harness",
        message: "mimic host connected document read is not stubbed",
      }),
    ),
  heartbeatPaywallConnection: () => Effect.void,
  openPaywallConnection: () =>
    Effect.fail(
      new MimicHostError({
        cause: "document connections are not available in the in-process backend harness",
        message: "mimic host document connection is not stubbed",
      }),
    ),
  submitConnectedPaywallTransaction: () =>
    Effect.fail(
      new MimicHostError({
        cause: "connected transaction submits are not available in the in-process backend harness",
        message: "mimic host connected transaction submit is not stubbed",
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
 * outside a Node/container host: it reports `unavailable`. Workspace diagnostics
 * for component files then degrade to cache-only (`unknown` on a miss), while
 * composition diagnostics still validate purely. Callers can provide a compiler
 * implementation when executable code checks are available.
 */
export const BackendComponentCompilerStubLive = Layer.succeed(ComponentCompiler, {
  compileCheck: () => Effect.succeed(constant({ status: "unavailable" })),
  compileAndExtract: () => Effect.succeed(constant({ status: "unavailable" })),
});

/** Renderer stub for backend harnesses without a headless browser binding. */
export const BackendSnapshotImageRendererStubLive = Layer.succeed(SnapshotImageRenderer, {
  render: () =>
    Effect.fail(
      new SnapshotImageRenderError({
        cause: "headless browser is not configured",
        message: "Paywall preview rendering is unavailable in this runtime",
      }),
    ),
});

export const BackendNoopIdentityProjectionPublisherLive = IdentityProjectionPublisher.noop;

const isAllowedCorsOrigin = (origin: string): boolean => {
  if (!URL.canParse(origin)) {
    return false;
  }
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
};

const corsHeaders = (origin: string | typeof Schema.Undefined.Type): Record<string, string> => {
  if (!origin || !isAllowedCorsOrigin(origin)) {
    return {};
  }
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-origin": origin,
    vary: "Origin",
  };
};

const preflightVary = (
  accessControlRequestHeaders: string | typeof Schema.Undefined.Type,
): string => {
  if (accessControlRequestHeaders) {
    return "Origin, Access-Control-Request-Headers";
  }
  return "Origin";
};

const preflightCorsHeaders = (
  origin: string | typeof Schema.Undefined.Type,
  accessControlRequestHeaders: string | typeof Schema.Undefined.Type,
): Record<string, string> => ({
  ...corsHeaders(origin),
  "access-control-allow-headers": accessControlRequestHeaders ?? "",
  "access-control-allow-methods": "GET, HEAD, PUT, PATCH, POST, DELETE",
  "access-control-max-age": "600",
  vary: preflightVary(accessControlRequestHeaders),
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

/** Feature-supplied capability flags advertised to clients, keyed by feature name. */
export type BackendRuntimeCapabilities = Readonly<Record<string, boolean>>;

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
  | OrganizationLifecyclePort
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
    | "pushDeliveryDispatch"
    | "mcpOAuth"
    | "analytics"
    | "eventAdmission"
  >,
) => {
  const RpcHandlersLayer = Layer.mergeAll(
    AgentSessionRpcsLive,
    AnalyticsRpcsLive,
    DevelopmentModeRpcsLive,
    ApiKeyRpcsLive,
    EventAdmissionRpcsLive,
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
    WebhookRpcsLive,
  );

  const foundation = buildBackendFoundation(layers.infrastructure);
  const FeatureSupportServicesLayer = layers.features.supportServices(foundation);

  const IdentityLinkBackfillServiceLayer = IdentityLinkBackfillService.layer.pipe(
    Layer.provide(foundation.FoundationSupportServicesLayer),
    Layer.provide(FeatureSupportServicesLayer),
    Layer.provide(layers.infrastructure),
  );

  const SupportServicesLayer = Layer.mergeAll(
    foundation.FoundationSupportServicesLayer,
    FeatureSupportServicesLayer,
    IdentityLinkBackfillServiceLayer,
  );

  // ExperimentService depends on FeatureFlagService (its backing-flag engine),
  // provided explicitly since `mergeAll` does not cross-wire siblings. Shared
  // (memoized by layer reference) between the standalone entry below and
  // PaywallLocationService, which depends on it at serve time.
  const ExperimentServiceLayer = ExperimentService.layer.pipe(
    Layer.provide(FeatureFlagService.layer),
  );

  const PaywallWorkspaceServiceLive = PaywallWorkspaceService.layer.pipe(
    Layer.provide(PaywallService.layer),
    Layer.provide(ComponentManifestCacheService.layer),
  );

  const PaywallThumbnailServiceLive = PaywallThumbnailService.layer.pipe(
    Layer.provide(ComponentManifestCacheService.layer),
  );

  const AgentSessionIndexServiceLive = AgentSessionIndexService.layer;
  const AnalyticsLive = layers.analytics ?? makePostgresAnalyticsLive();
  const BaseDomainServicesLayer = Layer.mergeAll(
    AgentSessionIndexServiceLive,
    AgentAttachmentService.layer.pipe(Layer.provide(AgentSessionIndexServiceLive)),
    AnalyticsLive,
    ApiKeyService.layer,
    BackendFeedbackServiceLive,
    BackendAppStorePaymentProviderServiceLive,
    BackendGooglePlayPaymentProviderServiceLive,
    BackendStripePaymentProviderServiceLive,
    ExperimentServiceLayer,
    FeatureFlagService.layer,
    InternalFeatureFlagService.layer,
    layers.eventAdmission ?? EventAdmissionService.layer("oss"),
    layers.mcpOAuth ?? McpOAuthUnconfiguredLive,
    // Push notifications: the per-(project, provider) config CRUD consumes the
    // two delivery-provider tags (supplied by BackendPushProvidersLive below)
    // and reads PUSH_REQUIRE_ENCRYPTION so prod fails closed on plaintext secrets.
    NotificationsConfigurationService.layer({
      requireEncryption: envString("PUSH_REQUIRE_ENCRYPTION").pipe(
        Effect.map((value) => value === "true"),
      ),
    }),
    // Read-only send-history surface backing the "sent notifications" activity page.
    PushNotificationSendService.layer,
    PersonNotificationTokenService.layer,
    OrganizationService.layer,
    PaywallAssetService.layer,
    PaymentProviderManagementLive,
    PaywallDeployService.layer,
    PaywallLocationService.layer.pipe(Layer.provide(ExperimentServiceLayer)),
    PaywallReleaseService.layer.pipe(Layer.provide(BackendSnapshotHtmlRendererLive)),
    PaywallService.layer,
    PaywallThumbnailServiceLive,
    ComponentManifestCacheService.layer,
    // The workspace service needs PaywallService (authz + slug resolution) and
    // the manifest cache; `mergeAll` does not cross-wire siblings, so both are
    // provided explicitly. MimicHost and ComponentCompiler come from the
    // infrastructure layer.
    PaywallWorkspaceServiceLive,
    PaywallEditSessionService.layer.pipe(Layer.provide(PaywallWorkspaceServiceLive)),
    PerkGrantService.layer,
    PerkService.layer,
    PersonService.layer,
    ProductPerkService.layer,
    ProductService.layer,
    ProjectService.layer,
    PurchaseQueryLive,
    SchemaService.layer,
    UserService.layer,
    layers.webhookManager ?? WebhookManagerService.layer,
  ).pipe(Layer.provide(BackendPushProvidersLive), Layer.provide(SupportServicesLayer));

  const DomainServicesLayer = Layer.mergeAll(
    BaseDomainServicesLayer,
    DevelopmentPaymentProviderService.layer.pipe(
      Layer.provide(BackendPurchasesLive),
      Layer.provide(SupportServicesLayer),
    ),
    SdkService.layer.pipe(
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

/**
 * Builds the support and domain services needed by long-lived agent hosts.
 * Unlike the HTTP composition this returns the service context itself, allowing
 * WebSocket runtimes to capture it once and execute workspace tools in-process.
 */
export const buildBackendAgentServices = <
  RInfrastructure = never,
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
>(
  layers: Pick<
    BackendRuntimeLayers<RInfrastructure, RFeatureRpcs, RFeatureServices>,
    | "features"
    | "infrastructure"
    | "webhookManager"
    | "pushDeliveryDispatch"
    | "mcpOAuth"
    | "analytics"
    | "eventAdmission"
  >,
) => {
  const graph = buildBackendServiceGraph(layers);
  return graph.DomainServicesLayer.pipe(Layer.provideMerge(graph.SupportServicesLayer));
};

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
  runtimeCapabilities: {},
  services: () => Layer.empty,
  supportServices: () =>
    Layer.mergeAll(
      AuditLogPort.noop,
      OrganizationLifecyclePort.noop,
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
 * the shared workflow runtime resolved lazily at request time.
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
    | "analytics"
    | "rpcExtension"
    | "mcpOAuth"
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
    AnalyticsGroupLive,
    ApiKeysGroupLive,
    AuthGroupLive,
    DevelopmentGroupLive,
    EventsGroupLive,
    ExperimentsGroupLive,
    FeatureFlagOverridesGroupLive,
    FeatureFlagTargetsGroupLive,
    FeatureFlagsGroupLive,
    IngestPolicyGroupLive,
    NotificationSendsGroupLive,
    NotificationsGroupLive,
    OrganizationsGroupLive,
    PaymentProviderConfigurationsGroupLive,
    PaymentProviderProductsGroupLive,
    PaywallDeploysGroupLive,
    PaywallLocationsGroupLive,
    PaywallsGroupLive,
    PerksGroupLive,
    PersonsGroupLive,
    ProductsGroupLive,
    ProjectsGroupLive,
    PushNotificationConfigurationsGroupLive,
    SchemaGroupLive,
    SdkGroupLive,
    UsersGroupLive,
    WebhooksGroupLive,
  );

  // Provided to every group as the per-request `AuthMiddleware` impl. Itself
  // depends on `ApiKeyService` and `LocalUserSessionService` —
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
  // `router.add` handler's service requirements (DB +
  // LocalUserSessionService + OrganizationMembershipWebhookPort for the WorkOS
  // one) surface as a deferred
  // `Request.From<"Requires", …>` that resolves at request time, NOT a normal
  // layer dependency — so `Layer.provide` does not discharge it (it would
  // silently leak to the request handler and die with "Service not found").
  // `HttpRouter.provideRequest` is the combinator that satisfies these
  // request-scoped requirements. Feature-supplied webhook routes resolve their
  // own services at request time the same way (all part of the merged graph
  // below); the Apple handler resolves the live public App Store service; the
  // Google handler additionally resolves its Pub/Sub OIDC verifier.
  //
  // The provider ingress routes are merged as `InboundWebhookRoutesLayer` — the
  // composition derived from `routes/webhook-endpoints/manifest.ts` — and never
  // one by one here, because that manifest is what the smoke endpoint registry
  // enumerates. Add a new ingress route to the manifest, not to this list.
  const WebhookRoutesLayer = Layer.mergeAll(
    InboundWebhookRoutesLayer,
    layers.routeExtension ?? Layer.empty,
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

  // MCP endpoint (`POST /api/mcp`, stateless streamable HTTP). Its request-scoped
  // requirements — `ApiKeyService` (secret-key auth) + `PaywallWorkspaceService`
  // + `Db` (key validation) — are satisfied via `provideRequest`.
  // `AuthSession` is provided in-handler from the validated secret key. Unlike
  // the agent-session route, MCP needs no JWT namespace (it authenticates with v1
  // secret keys), so it registers unconditionally.
  const McpRoutesLayer = McpRouteLayer.pipe(
    HttpRouter.provideRequest(Layer.mergeAll(DomainServicesLayer, SupportServicesLayer)),
  );

  const McpOAuthRoutesLayer = McpOAuthRouteLayer.pipe(
    HttpRouter.provideRequest(Layer.mergeAll(DomainServicesLayer, SupportServicesLayer)),
  );

  const RoutesLayer = Layer.mergeAll(
    RpcRoutesLayer,
    V1ApiRoutes,
    WebhookRoutesLayer,
    PaywallServingLayer,
    PublicFileServingLayer,
    McpRoutesLayer,
    McpOAuthRoutesLayer,
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
