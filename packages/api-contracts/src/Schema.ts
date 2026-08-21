import { Schema } from "effect";
import { HttpApiSchema } from "effect/unstable/httpapi";

export const PublishableKeyAuthHeaders = Schema.Struct({
  "x-distinct-id": Schema.String,
  "x-publishable-key": Schema.String,
});

export const ApiKeyAuthHeaders = Schema.Struct({
  "x-api-key": Schema.String,
});

export const SecretKeyAuthHeaders = Schema.Struct({
  "x-secret-key": Schema.String,
});

// ========================================================
// Auth
// ========================================================

const SessionAuthMethods = Schema.Union([
  Schema.Literal("api-key"),
  Schema.Literal("publishable-key"),
  Schema.Literal("secret-key"),
]);

export const Session = Schema.Struct({
  method: SessionAuthMethods,
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.String,
    }),
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    }),
  ),
});

// ========================================================
// API Keys
// ========================================================

export class ApiKey extends Schema.Class<ApiKey>("ApiKey")({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
  rawKey: Schema.optional(Schema.String),
}) {}

export class ApiKeyWithRawKey extends Schema.Class<ApiKeyWithRawKey>("ApiKeyWithRawKey")({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
  rawKey: Schema.String,
}) {}

export class CreateSecretKeyBody extends Schema.Class<CreateSecretKeyBody>("CreateSecretKeyBody")({
  name: Schema.String,
  projectId: Schema.String,
}) {}

export const ApiKeyIdParam = Schema.String;

// ========================================================
// Persons
// ========================================================

export class Person extends Schema.Class<Person>("Person")({
  personId: Schema.String,
  distinctId: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
}) {}

export class CreatePersonBody extends Schema.Class<CreatePersonBody>("CreatePersonBody")({
  distinctId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
}) {}

export const PersonIdParam = Schema.String;

export const DistinctIdParam = Schema.String;

// ========================================================
// Organizations
// ========================================================

export class CreateOrganizationBody extends Schema.Class<CreateOrganizationBody>(
  "CreateOrganizationBody",
)({
  name: Schema.String,
}) {}

export class Organization extends Schema.Class<Organization>("Organization")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
}) {}

// ========================================================
// Perks
// ========================================================

export class Perk extends Schema.Class<Perk>("Perk")({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
}) {}

// ========================================================
// Paywall Locations
// ========================================================

export class PaywallLocation extends Schema.Class<PaywallLocation>("PaywallLocation")({
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
}) {}

// ========================================================
// Products
// ========================================================

export const ProductType = Schema.Literals(["subscription", "one-time", "one-time-consumable"]);

export class Product extends Schema.Class<Product>("Product")({
  duration: Schema.NullOr(Schema.Number),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  type: ProductType,
}) {}

// ========================================================
// Product Perks
// ========================================================

export const ProductIdParam = Schema.String;

export class ProductPerk extends Schema.Class<ProductPerk>("ProductPerk")({
  id: Schema.String,
  perkId: Schema.String,
  productId: Schema.String,
}) {}

// ========================================================
// Payment Provider Configurations
// ========================================================

export class PaymentProviderConfiguration extends Schema.Class<PaymentProviderConfiguration>(
  "PaymentProviderConfiguration",
)({
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
}) {}

// ========================================================
// Payment Provider Products
// ========================================================

export class PaymentProviderProduct extends Schema.Class<PaymentProviderProduct>(
  "PaymentProviderProduct",
)({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  id: Schema.String,
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
  providerId: Schema.String,
}) {}

// ========================================================
// Projects
// ========================================================

export class CreateProjectBody extends Schema.Class<CreateProjectBody>("CreateProjectBody")({
  name: Schema.String,
  organizationId: Schema.String,
}) {}

export class Project extends Schema.Class<Project>("Project")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
}) {}

export const OrganizationIdParam = Schema.String;

// ========================================================
// SDK
// ========================================================

const CommonSdkHeaders = Schema.Struct({
  "x-client-bundle-id": Schema.String,
  "x-client-locale": Schema.optional(Schema.String),
  "x-client-version": Schema.optional(Schema.String),
  "x-is-backgrounded": Schema.Literal("false"),
  "x-is-debug-build": Schema.Literals(["true", "false"]),
  "x-nonce": Schema.optional(Schema.String),
  "x-observer-mode": Schema.Literals(["true", "false"]),
  "x-platform": Schema.String,
  "x-platform-brand": Schema.optional(Schema.String),
  "x-platform-device": Schema.optional(Schema.String),
  "x-platform-flavor": Schema.Literals(["native", "browser"]),
  "x-platform-flavor-version": Schema.optional(Schema.String),
  "x-platform-version": Schema.optional(Schema.String),
  "x-preferred-locales": Schema.optional(Schema.String),
  "x-sdk": Schema.Literals(["react-native", "web", "ios", "android"]),
  "x-sdk-version": Schema.String,
  "x-storefront": Schema.optional(Schema.String),
  "x-environment": Schema.optional(Schema.Literals(["production", "development", "all"])),
});

export const SdkHeaders = Schema.Struct({
  ...PublishableKeyAuthHeaders.fields,
  ...CommonSdkHeaders.fields,
});

const SdkTraitValue = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);

const SdkTraits = Schema.Record(Schema.String, SdkTraitValue);

// SDK Identify
export class SdkIdentifyBody extends Schema.Class<SdkIdentifyBody>("SdkIdentifyBody")({
  distinctId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  traits: Schema.optional(SdkTraits),
}) {}

// SDK Sync Person Attributes
export class SdkSyncPersonAttributesBody extends Schema.Class<SdkSyncPersonAttributesBody>(
  "SdkSyncPersonAttributesBody",
)({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  // `$set` semantics — newest write wins per key.
  traits: Schema.optional(SdkTraits),
  // `$set_once` semantics — earliest write wins; loses to any `$set`.
  setOnce: Schema.optional(SdkTraits),
  // Stable client-supplied id for deterministic LWW tie-break. Lets a sync
  // write and its eventual async `$set` echo dedupe idempotently.
  clientEventId: Schema.optional(Schema.String),
}) {}

// SDK Push device registration — exchange a platform credential for our UUID.
// Routing is PROVIDER-driven, not platform-driven (see the token abstraction).
export class RegisterDeviceBody extends Schema.Class<RegisterDeviceBody>("RegisterDeviceBody")({
  platform: Schema.Literals(["ios", "android"]),
  provider: Schema.Literals(["fcm", "apns"]),
  // FCM registration token OR raw APNs device-token hex. Non-empty enforced at
  // the contract boundary (the apns-requires-bundleId/environment rule is
  // conditional, so it stays a server-side check in NotificationTokenService).
  platformToken: Schema.String.check(Schema.isMinLength(1)),
  bundleId: Schema.optional(Schema.String), // required for apns/ios
  environment: Schema.optional(Schema.Literals(["sandbox", "production"])), // apns only
  previousPushDeviceTokenId: Schema.optional(Schema.String), // eager-reap hint on reinstall
}) {}

// SDK Push device token rotation under the SAME UUID (same-install only).
export class RefreshDeviceBody extends Schema.Class<RefreshDeviceBody>("RefreshDeviceBody")({
  pushDeviceTokenId: Schema.String, // push_tok_* (OUR UUID)
  platformToken: Schema.String.check(Schema.isMinLength(1)),
}) {}

// SDK Push device unregister.
export class UnregisterDeviceBody extends Schema.Class<UnregisterDeviceBody>(
  "UnregisterDeviceBody",
)({
  pushDeviceTokenId: Schema.String,
}) {}

// We hand back ONLY our opaque UUID, never the raw platform credential.
export class RegisterDeviceResponse extends Schema.Class<RegisterDeviceResponse>(
  "RegisterDeviceResponse",
)({
  pushDeviceTokenId: Schema.String, // push_tok_*
}) {}

// Server-to-server push dispatch: target one or more persons (by canonical
// personId and/or distinctId) with a notification. Privileged — secret-key auth.
export class SendNotificationBody extends Schema.Class<SendNotificationBody>(
  "SendNotificationBody",
)({
  // Targeting — at least one of `personIds`/`distinctIds` must be non-empty
  // (server-checked). Unmapped distinctIds are recorded, never fatal.
  personIds: Schema.optional(Schema.Array(Schema.String)),
  distinctIds: Schema.optional(Schema.Array(Schema.String)),
  // Notification content (the unified cross-platform message).
  title: Schema.String.check(Schema.isMinLength(1)),
  body: Schema.String.check(Schema.isMinLength(1)),
  data: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  sound: Schema.optional(Schema.String),
  badge: Schema.optional(Schema.Number),
  priority: Schema.optional(Schema.Literals(["default", "high"])),
  ttl: Schema.optional(Schema.Number), // seconds
  channelId: Schema.optional(Schema.String), // android channel
  collapseId: Schema.optional(Schema.String),
  // Optional key collapsing retried sends into a single dispatch (per project).
  idempotencyKey: Schema.optional(Schema.String),
}) {}

// The send is enqueued asynchronously; we return the tracking id + up-front counts.
export class SendNotificationResponse extends Schema.Class<SendNotificationResponse>(
  "SendNotificationResponse",
)({
  pushNotificationSendId: Schema.String, // push_send_*
  deviceCount: Schema.Number,
  status: Schema.Literals([
    "pending",
    "in_progress",
    "succeeded",
    "partial_failed",
    "failed",
    "no_recipients",
  ]),
  unresolvedDistinctIds: Schema.Array(Schema.String),
}) {}

export const SdkSyncTransactionBody = Schema.Struct({
  // The deterministic account token (UUIDv5 of the distinctId) the client set
  // as Apple's `appAccountToken` / Google's `obfuscatedAccountId`. Optional and
  // advisory only — the server re-fetches and verifies the JWS from the store,
  // so this is observability/diagnostics, never trusted for authorization.
  appAccountToken: Schema.optional(Schema.String),
  platform: Schema.Literals(["ios", "android"]),
  // Native store identifier used for canonical verification. Kept separate
  // from the Voidhash product slug because they are not generally equal.
  providerProductId: Schema.optional(Schema.String),
  productSlug: Schema.String,
  purchaseDate: Schema.Number,
  purchaseToken: Schema.optional(Schema.String),
  quantity: Schema.Number,
  receipt: Schema.optional(Schema.String),
  transactionId: Schema.String,
});

export class SdkSyncTransactionResponse extends Schema.Class<SdkSyncTransactionResponse>(
  "SdkSyncTransactionResponse",
)({
  accepted: Schema.Boolean,
}) {}

export class SdkDevelopmentPurchaseBody extends Schema.Class<SdkDevelopmentPurchaseBody>(
  "SdkDevelopmentPurchaseBody",
)({
  devTransactionId: Schema.String,
  productSlug: Schema.String,
  purchaseDate: Schema.Number,
  quantity: Schema.optional(Schema.Number),
}) {}

export class SdkDevelopmentPurchaseResponse extends Schema.Class<SdkDevelopmentPurchaseResponse>(
  "SdkDevelopmentPurchaseResponse",
)({
  accepted: Schema.Boolean,
  warning: Schema.NullOr(Schema.String),
}) {}

export const SdkSubscriptionHistoryStatus = Schema.Literals([
  "active",
  "canceled",
  "expired",
  "trialing",
  "past_due",
]);

export const SdkSubscriptionCurrentStatus = Schema.Literals([
  "none",
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export const SdkGrantStatus = Schema.Literals(["active", "expired"]);

export const SdkGrantSource = Schema.Literals(["subscription", "purchase", "manual"]);

export const SdkPurchaseHistoryType = Schema.Literals(["one_time", "subscription"]);

export const SdkPersonSnapshotMode = Schema.Literals(["persisted", "temporary_pending_transfer"]);

export class SdkEntitlementGrant extends Schema.Class<SdkEntitlementGrant>("SdkEntitlementGrant")({
  expiresAt: Schema.NullOr(Schema.Date),
  perkId: Schema.String,
  source: SdkGrantSource,
  sourceId: Schema.NullOr(Schema.String),
  sourcePersonId: Schema.String,
  status: SdkGrantStatus,
}) {}

export class SdkCurrentSubscription extends Schema.Class<SdkCurrentSubscription>(
  "SdkCurrentSubscription",
)({
  expiresAt: Schema.NullOr(Schema.Date),
  productId: Schema.NullOr(Schema.String),
  status: SdkSubscriptionCurrentStatus,
  subscriptionId: Schema.NullOr(Schema.String),
}) {}

export class SdkSubscriptionHistoryEntry extends Schema.Class<SdkSubscriptionHistoryEntry>(
  "SdkSubscriptionHistoryEntry",
)({
  canceledAt: Schema.NullOr(Schema.Date),
  expiresAt: Schema.NullOr(Schema.Date),
  isTrial: Schema.Boolean,
  productId: Schema.NullOr(Schema.String),
  sourcePersonId: Schema.String,
  startsAt: Schema.Date,
  status: SdkSubscriptionHistoryStatus,
  subscriptionId: Schema.String,
}) {}

export class SdkPurchaseHistoryEntry extends Schema.Class<SdkPurchaseHistoryEntry>(
  "SdkPurchaseHistoryEntry",
)({
  createdAt: Schema.Date,
  productId: Schema.NullOr(Schema.String),
  providerKey: Schema.String,
  purchaseId: Schema.String,
  sourcePersonId: Schema.String,
  type: SdkPurchaseHistoryType,
}) {}

export class SdkPerson extends Schema.Class<SdkPerson>("SdkPerson")({
  distinctId: Schema.String,
  email: Schema.NullOr(Schema.String),
  entitlements: Schema.Struct({
    grants: Schema.Array(SdkEntitlementGrant),
  }),
  name: Schema.NullOr(Schema.String),
  personId: Schema.String,
  purchases: Schema.Struct({
    history: Schema.Array(SdkPurchaseHistoryEntry),
  }),
  snapshotContext: Schema.Struct({
    includedPersonIds: Schema.Array(Schema.String),
    migrationJobId: Schema.NullOr(Schema.String),
    mode: SdkPersonSnapshotMode,
  }),
  subscriptions: Schema.Struct({
    current: Schema.NullOr(SdkCurrentSubscription),
    history: Schema.Array(SdkSubscriptionHistoryEntry),
  }),
}) {}

// ========================================================
// Person Entitlements (secret-key management API)
// ========================================================

/**
 * Server-side view of a person's entitlement grants. Declared here rather than
 * in the Persons section above because it reuses {@link SdkEntitlementGrant} —
 * the management endpoint and `sdk.getPerson` must report the same grants for
 * the same person, so the shape is shared instead of forked.
 */
export class PersonEntitlementsResponse extends Schema.Class<PersonEntitlementsResponse>(
  "PersonEntitlementsResponse",
)({
  grants: Schema.Array(SdkEntitlementGrant),
}) {}

// ========================================================
// Consolidated schema (CLI + SDK)
// ========================================================

/**
 * Provider IDs the consolidated schema surfaces. Mirrors `ProviderId` in
 * the CLI's `apps/cli/src/domain/schema/normalized-schema.ts` — extending
 * this is a coordinated client+server change.
 */
export const SchemaProviderId = Schema.Literals(["appleAppStore", "googlePlay"]);
export type SchemaProviderId = typeof SchemaProviderId.Type;

/**
 * Free-form provider configuration blob — opaque to the schema. The CLI
 * round-trips it as-is; the SDK reads provider-specific keys
 * (`productId`, `basePlanId`, …) out of it at the native store boundary.
 */
const SchemaProviderConfiguration = Schema.Record(Schema.String, Schema.Unknown);

export class SchemaPerk extends Schema.Class<SchemaPerk>("SchemaPerk")({
  name: Schema.String,
  slug: Schema.String,
}) {}

export class SchemaLocation extends Schema.Class<SchemaLocation>("SchemaLocation")({
  description: Schema.NullOr(Schema.String),
  name: Schema.String,
  slug: Schema.String,
}) {}

export class SchemaProductProvider extends Schema.Class<SchemaProductProvider>(
  "SchemaProductProvider",
)({
  configuration: SchemaProviderConfiguration,
  providerId: SchemaProviderId,
}) {}

export class SchemaProduct extends Schema.Class<SchemaProduct>("SchemaProduct")({
  duration: Schema.NullOr(
    Schema.Literals(["weekly", "monthly", "quarterly", "semi-annual", "annual"]),
  ),
  name: Schema.String,
  /** Perk slugs (not IDs), ascending. */
  perks: Schema.Array(Schema.String),
  /** Per-provider mappings, sorted by `providerId`. */
  providers: Schema.Array(SchemaProductProvider),
  slug: Schema.String,
  type: Schema.Literals(["subscription", "one-time", "one-time-consumable"]),
}) {}

/**
 * Response shape for `GET /api/v1/schema` — the CLI-facing consolidated
 * read. Named `ProjectSchemaResponse` (rather than just `Schema`) to
 * avoid colliding with the `Schema` namespace re-exported from
 * `effect`.
 */
export class ProjectSchemaResponse extends Schema.Class<ProjectSchemaResponse>(
  "ProjectSchemaResponse",
)({
  enabledProviders: Schema.Array(SchemaProviderId),
  locations: Schema.Array(SchemaLocation),
  perks: Schema.Array(SchemaPerk),
  products: Schema.Array(SchemaProduct),
  /**
   * `sha256:<hex>` content hash of the normalized projection. Identical
   * to `GET /api/v1/schema/version`; used as the `ETag` for both
   * endpoints.
   */
  version: Schema.String,
}) {}

/**
 * Response shape for `GET /api/v1/schema/version` — the cheap version
 * probe used by the CLI watch loop and the SDK's drift warning.
 */
export class SchemaVersion extends Schema.Class<SchemaVersion>("SchemaVersion")({
  version: Schema.String,
}) {}

// ========================================================
// SDK runtime schema (`GET /api/v1/sdk/schema`)
// ========================================================

/**
 * Per-product `properties` block. Today this is just the human-readable
 * name; kept as a struct to mirror `RuntimeProductDefinition` in the SDK
 * (`libraries/react-native/src/core/schema/runtime.ts`) — extending it
 * server-side is a coordinated SDK change.
 */
const SdkSchemaProductProperties = Schema.Struct({
  name: Schema.String,
});

/**
 * Per-product `configuration` block, split out of `properties` to match
 * the SDK's existing internal shape (minimises the diff vs the old
 * DSL-built product definitions).
 */
const SdkSchemaProductConfiguration = Schema.Struct({
  /**
   * Set-of-perk-slugs as a `{ slug: true }` record; matches
   * `RuntimeProductDefinition.configuration.perks`.
   */
  perks: Schema.Record(Schema.String, Schema.Literal(true)),
  /**
   * Provider configurations keyed by provider ID. Optional per-provider
   * because not every product has every provider configured.
   */
  providers: Schema.Struct({
    appleAppStore: Schema.optional(SchemaProviderConfiguration),
    development: Schema.Struct({
      currencyCode: Schema.Literal("USD"),
      duration: Schema.NullOr(
        Schema.Literals(["weekly", "monthly", "quarterly", "semi-annual", "annual"]),
      ),
      period: Schema.Literals(["week", "month", "year", "lifetime"]),
      periodCount: Schema.Number,
      price: Schema.Number,
      priceInMinorUnits: Schema.Number,
      productId: Schema.String,
      warning: Schema.NullOr(Schema.String),
    }),
    googlePlay: Schema.optional(SchemaProviderConfiguration),
  }),
});

export class SdkSchemaProduct extends Schema.Class<SdkSchemaProduct>("SdkSchemaProduct")({
  configuration: SdkSchemaProductConfiguration,
  properties: SdkSchemaProductProperties,
  id: Schema.String,
  duration: Schema.NullOr(
    Schema.Literals(["weekly", "monthly", "quarterly", "semi-annual", "annual"]),
  ),
  slug: Schema.String,
  type: Schema.Literals(["subscription", "one-time", "one-time-consumable"]),
}) {}

export class SdkSchemaPerk extends Schema.Class<SdkSchemaPerk>("SdkSchemaPerk")({
  name: Schema.String,
  slug: Schema.String,
}) {}

export class SdkSchemaLocation extends Schema.Class<SdkSchemaLocation>("SdkSchemaLocation")({
  description: Schema.NullOr(Schema.String),
  name: Schema.String,
  slug: Schema.String,
}) {}

/**
 * Response shape for `GET /api/v1/sdk/schema` — the runtime schema the
 * SDK fetches on `Provider` mount. Mirrors `RuntimeSchema` in
 * `libraries/react-native/src/core/schema/runtime.ts`.
 *
 * Differences from `Schema_` (CLI-facing): object-keyed by slug instead
 * of arrays of objects (the SDK looks products up by slug at runtime),
 * and `enabledProviders` is omitted (the SDK doesn't need it).
 */
export class SdkSchema extends Schema.Class<SdkSchema>("SdkSchema")({
  locations: Schema.Record(Schema.String, SdkSchemaLocation),
  perks: Schema.Record(Schema.String, SdkSchemaPerk),
  products: Schema.Record(Schema.String, SdkSchemaProduct),
  version: Schema.String,
}) {}

// ========================================================
// User
// ========================================================

export class User extends Schema.Class<User>("User")({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      slug: Schema.String,
      workosOrganizationId: Schema.NullOr(Schema.String),
    }),
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    }),
  ),
  updatedAt: Schema.Date,
}) {}

// ========================================================
// Webhooks
// ========================================================

export const WebhookEventType = Schema.Literals([
  "person.created",
  "person.updated",
  "person.deleted",
  "subscription.created",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.expired",
  "purchase.completed",
  "purchase.refunded",
]);

export const WebhookEndpointStatus = Schema.Literals(["active", "disabled", "failed"]);

export const WebhookDeliveryStatus = Schema.Literals([
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "exhausted",
]);

export class WebhookEndpoint extends Schema.Class<WebhookEndpoint>("WebhookEndpoint")({
  consecutiveFailures: Schema.Number,
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  events: Schema.Array(WebhookEventType),
  id: Schema.String,
  lastSuccessAt: Schema.NullOr(Schema.Date),
  name: Schema.String,
  projectId: Schema.String,
  secret: Schema.String,
  status: WebhookEndpointStatus,
  url: Schema.String,
}) {}

export class CreateWebhookEndpointBody extends Schema.Class<CreateWebhookEndpointBody>(
  "CreateWebhookEndpointBody",
)({
  description: Schema.optional(Schema.String),
  events: Schema.Array(Schema.String),
  name: Schema.String,
  url: Schema.String,
}) {}

export class UpdateWebhookEndpointBody extends Schema.Class<UpdateWebhookEndpointBody>(
  "UpdateWebhookEndpointBody",
)({
  description: Schema.optional(Schema.NullOr(Schema.String)),
  events: Schema.optional(Schema.Array(Schema.String)),
  name: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literals(["active", "disabled"])),
  url: Schema.optional(Schema.String),
}) {}

export const WebhookEndpointIdParam = Schema.String;

export class WebhookDelivery extends Schema.Class<WebhookDelivery>("WebhookDelivery")({
  attemptCount: Schema.Number,
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  eventOccurredAt: Schema.Date,
  eventType: Schema.String,
  id: Schema.String,
  maxAttempts: Schema.Number,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  payload: Schema.Unknown,
  projectId: Schema.String,
  status: WebhookDeliveryStatus,
  webhookEndpointId: Schema.String,
}) {}

export class WebhookDeliveryAttempt extends Schema.Class<WebhookDeliveryAttempt>(
  "WebhookDeliveryAttempt",
)({
  attemptNumber: Schema.Number,
  createdAt: Schema.NullOr(Schema.Date),
  durationMs: Schema.NullOr(Schema.Number),
  errorMessage: Schema.NullOr(Schema.String),
  id: Schema.String,
  responseBody: Schema.NullOr(Schema.String),
  statusCode: Schema.NullOr(Schema.Number),
  succeeded: Schema.Boolean,
}) {}

export class WebhookDeliveryWithAttempts extends Schema.Class<WebhookDeliveryWithAttempts>(
  "WebhookDeliveryWithAttempts",
)({
  attemptCount: Schema.Number,
  attempts: Schema.Array(WebhookDeliveryAttempt),
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  eventOccurredAt: Schema.Date,
  eventType: Schema.String,
  id: Schema.String,
  maxAttempts: Schema.Number,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  payload: Schema.Unknown,
  projectId: Schema.String,
  status: WebhookDeliveryStatus,
  webhookEndpointId: Schema.String,
}) {}

export const WebhookDeliveryIdParam = Schema.String;

// ========================================================
// Webhook event payloads (outbound HTTP body)
// ========================================================

/**
 * Payment provider that drove the transition. Mirrors `PaymentProviderId` in
 * `packages/core/src/domain/paymentProvider/PaymentProviderConfiguration.ts`;
 * extending it is a coordinated contract change.
 */
export const WebhookPaymentProvider = Schema.Literals([
  "apple-app-store",
  "development",
  "google-play",
  "stripe",
]);
export type WebhookPaymentProvider = typeof WebhookPaymentProvider.Type;

/** Store environment the transition happened in — the live/test distinction. */
export const WebhookEnvironment = Schema.Literals(["production", "sandbox", "development"]);
export type WebhookEnvironment = typeof WebhookEnvironment.Type;

/** Operational subscription status after the transition was applied. */
export const WebhookSubscriptionStatus = Schema.Literals(["active", "canceled"]);
export type WebhookSubscriptionStatus = typeof WebhookSubscriptionStatus.Type;

/** Non-subscription purchase flavour. */
export const WebhookPurchaseKind = Schema.Literals(["one_time", "consumable"]);
export type WebhookPurchaseKind = typeof WebhookPurchaseKind.Type;

/**
 * Gross charge in the buyer's currency, in minor units (cents). `null` when the
 * provider event carried no money breakdown — never zero-filled, so receivers
 * can tell "no amount reported" from "amount was zero".
 */
export class WebhookMoney extends Schema.Class<WebhookMoney>("WebhookMoney")({
  currency: Schema.String,
  grossAmount: Schema.Number,
}) {}

/**
 * Fields present on every lifecycle payload. Timestamps are ISO-8601 UTC
 * strings rather than `Schema.Date` so the JSON body is stable across
 * receivers and does not depend on a codec.
 */
const webhookEventBaseFields = {
  distinctId: Schema.String,
  environment: WebhookEnvironment,
  occurredAt: Schema.String,
  personId: Schema.String,
  productId: Schema.String,
  productSlug: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  provider: WebhookPaymentProvider,
  providerProductId: Schema.String,
};

/** Fields shared by the four subscription lifecycle payloads. */
const webhookSubscriptionBaseFields = {
  ...webhookEventBaseFields,
  providerSubscriptionId: Schema.NullOr(Schema.String),
  providerTransactionId: Schema.NullOr(Schema.String),
  status: WebhookSubscriptionStatus,
  subscriptionId: Schema.String,
};

export class WebhookSubscriptionCreatedPayload extends Schema.Class<WebhookSubscriptionCreatedPayload>(
  "WebhookSubscriptionCreatedPayload",
)({
  ...webhookSubscriptionBaseFields,
  amount: Schema.NullOr(WebhookMoney),
  expiresAt: Schema.NullOr(Schema.String),
  isTrial: Schema.Boolean,
  purchasedAt: Schema.String,
  startsAt: Schema.String,
  type: Schema.Literal("subscription.created"),
}) {}

export class WebhookSubscriptionRenewedPayload extends Schema.Class<WebhookSubscriptionRenewedPayload>(
  "WebhookSubscriptionRenewedPayload",
)({
  ...webhookSubscriptionBaseFields,
  amount: Schema.NullOr(WebhookMoney),
  expiresAt: Schema.NullOr(Schema.String),
  isTrial: Schema.Boolean,
  renewedAt: Schema.String,
  startsAt: Schema.String,
  type: Schema.Literal("subscription.renewed"),
}) {}

export class WebhookSubscriptionCancelledPayload extends Schema.Class<WebhookSubscriptionCancelledPayload>(
  "WebhookSubscriptionCancelledPayload",
)({
  ...webhookSubscriptionBaseFields,
  /** `true` when access runs to the end of the paid period; `false` on immediate loss. */
  cancelAtPeriodEnd: Schema.Boolean,
  canceledAt: Schema.String,
  cancellationReason: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.String),
  type: Schema.Literal("subscription.cancelled"),
}) {}

export class WebhookSubscriptionExpiredPayload extends Schema.Class<WebhookSubscriptionExpiredPayload>(
  "WebhookSubscriptionExpiredPayload",
)({
  ...webhookSubscriptionBaseFields,
  expiredAt: Schema.String,
  type: Schema.Literal("subscription.expired"),
}) {}

export class WebhookPurchaseCompletedPayload extends Schema.Class<WebhookPurchaseCompletedPayload>(
  "WebhookPurchaseCompletedPayload",
)({
  ...webhookEventBaseFields,
  amount: Schema.NullOr(WebhookMoney),
  providerKey: Schema.String,
  providerTransactionId: Schema.NullOr(Schema.String),
  purchaseId: Schema.String,
  purchaseKind: WebhookPurchaseKind,
  purchasedAt: Schema.String,
  type: Schema.Literal("purchase.completed"),
}) {}

export class WebhookPurchaseRefundedPayload extends Schema.Class<WebhookPurchaseRefundedPayload>(
  "WebhookPurchaseRefundedPayload",
)({
  ...webhookEventBaseFields,
  amount: Schema.NullOr(WebhookMoney),
  providerTransactionId: Schema.NullOr(Schema.String),
  /** `null` when the refund could not be anchored to a stored purchase row. */
  purchaseId: Schema.NullOr(Schema.String),
  refundReason: Schema.NullOr(Schema.String),
  refundedAt: Schema.String,
  type: Schema.Literal("purchase.refunded"),
}) {}

/**
 * Discriminated union of every lifecycle payload we currently emit, keyed by
 * `type`. The HTTP body is the bare payload — there is no envelope — and the
 * event name is repeated in the `X-Webhook-Event` header.
 *
 * `person.created` / `person.updated` / `person.deleted` are declared in
 * {@link WebhookEventType} but have no payload here yet: nothing emits them.
 */
export const WebhookEventPayload = Schema.Union([
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionRenewedPayload,
  WebhookSubscriptionCancelledPayload,
  WebhookSubscriptionExpiredPayload,
  WebhookPurchaseCompletedPayload,
  WebhookPurchaseRefundedPayload,
]);
export type WebhookEventPayload = typeof WebhookEventPayload.Type;

// ========================================================
// Feature Flags (SDK)
// ========================================================

export class EvaluateFeatureFlagsBody extends Schema.Class<EvaluateFeatureFlagsBody>(
  "EvaluateFeatureFlagsBody",
)({
  flagKeys: Schema.optional(Schema.Array(Schema.String)),
}) {}

export class SdkFeatureFlagResult extends Schema.Class<SdkFeatureFlagResult>(
  "SdkFeatureFlagResult",
)({
  enabled: Schema.Boolean,
  key: Schema.String,
  payload: Schema.NullOr(Schema.Unknown),
  variantKey: Schema.NullOr(Schema.String),
}) {}

export class SdkFeatureFlagsResponse extends Schema.Class<SdkFeatureFlagsResponse>(
  "SdkFeatureFlagsResponse",
)({
  flags: Schema.Array(SdkFeatureFlagResult),
}) {}

// ========================================================
// Paywall Resolution (SDK)
// ========================================================

export class SdkResolvePaywallBody extends Schema.Class<SdkResolvePaywallBody>(
  "SdkResolvePaywallBody",
)({
  locationSlug: Schema.String,
}) {}

const SdkResolvedPaywallShowingType = Schema.Literals(["paywall_release", "feature_flag"]);

const SdkResolvedPaywallShowingPaywall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});

/**
 * Variable values a code-deployed paywall accepts (deploy contract §1):
 * `string | number | boolean` only.
 */
const SdkPaywallRuntimeVariableValue = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);

/**
 * Code-deploy runtime block forwarded verbatim through resolve (deploy
 * contract §6). `null` for visual-editor releases. The device SDK caches the
 * bundle by `contentHash`, maps `productSlugs` through its native store
 * metadata, and passes `variables` through unchanged.
 */
const SdkResolvedPaywallReleaseRuntime = Schema.Struct({
  contentHash: Schema.String,
  productSlugs: Schema.Array(Schema.String),
  variables: Schema.Record(Schema.String, SdkPaywallRuntimeVariableValue),
});

const SdkResolvedPaywallShowingPaywallRelease = Schema.Struct({
  htmlUrl: Schema.String,
  publishedAt: Schema.NullOr(Schema.Date),
  releaseId: Schema.String,
  runtime: Schema.NullOr(SdkResolvedPaywallReleaseRuntime),
  version: Schema.Number,
});

export class SdkResolvedPaywallShowing extends Schema.Class<SdkResolvedPaywallShowing>(
  "SdkResolvedPaywallShowing",
)({
  id: Schema.String,
  paywall: Schema.NullOr(SdkResolvedPaywallShowingPaywall),
  paywallId: Schema.NullOr(Schema.String),
  paywallRelease: Schema.NullOr(SdkResolvedPaywallShowingPaywallRelease),
  paywallReleaseId: Schema.NullOr(Schema.String),
  startedAt: Schema.Date,
  type: SdkResolvedPaywallShowingType,
}) {}

export class SdkResolvedPaywall extends Schema.Class<SdkResolvedPaywall>("SdkResolvedPaywall")({
  location: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  }),
  showing: SdkResolvedPaywallShowing,
}) {}

// ========================================================
// Paywall Code Deploys (deploy contract §4)
// ========================================================

/**
 * Request body for `POST /api/v1/paywall-deploys` — the §1 deploy manifest.
 *
 * Deliberately `Schema.Unknown` rather than a typed mirror of the manifest:
 * the authoritative validation lives in `packages/core`
 * (`PaywallDeployManifestSchema`, strict `onExcessProperty: "error"` decode)
 * where an unknown `schemaVersion` must produce a dedicated 400
 * "upgrade the CLI" error *before* full validation, and unknown keys must be
 * rejected rather than silently stripped — both of which a typed HTTP-layer
 * decode would preempt.
 */
export const PaywallDeployManifestBody = Schema.Unknown;

/**
 * Request body for `PUT /api/v1/paywall-deploys/:deployId/blobs/:sha256` —
 * the raw `application/octet-stream` blob bytes (deploy contract §4.2).
 */
export const PaywallDeployBlobBody = Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array());

/** Response for `POST /api/v1/paywall-deploys` (deploy contract §4.1, 201). */
export class CreatePaywallDeployResponse extends Schema.Class<CreatePaywallDeployResponse>(
  "CreatePaywallDeployResponse",
)({
  deployId: Schema.String,
  /** Manifest file hashes the server does not yet have stored for this project. */
  missing: Schema.Array(Schema.String),
}) {}

/** Empty `200 {}` response for blob upload (deploy contract §4.2). */
export class UploadPaywallDeployBlobResponse extends Schema.Class<UploadPaywallDeployBlobResponse>(
  "UploadPaywallDeployBlobResponse",
)({}) {}

/** Per-paywall finalize summary (deploy contract §4.3). */
export class FinalizedPaywallDeployPaywall extends Schema.Class<FinalizedPaywallDeployPaywall>(
  "FinalizedPaywallDeployPaywall",
)({
  contentHash: Schema.String,
  /** Manifest paywall id (slug). */
  id: Schema.String,
  paywallId: Schema.String,
  releaseId: Schema.String,
  url: Schema.String,
  version: Schema.Number,
}) {}

/** Per-component finalize summary (deploy contract §4.3). */
export class FinalizedPaywallDeployComponent extends Schema.Class<FinalizedPaywallDeployComponent>(
  "FinalizedPaywallDeployComponent",
)({
  componentId: Schema.String,
  contentHash: Schema.String,
  /** Manifest component id (slug). */
  id: Schema.String,
  version: Schema.Number,
}) {}

/** Response for `POST /api/v1/paywall-deploys/:deployId/finalize` (§4.3). */
export class FinalizePaywallDeployResponse extends Schema.Class<FinalizePaywallDeployResponse>(
  "FinalizePaywallDeployResponse",
)({
  components: Schema.Array(FinalizedPaywallDeployComponent),
  deployId: Schema.String,
  paywalls: Schema.Array(FinalizedPaywallDeployPaywall),
  status: Schema.Literal("ready"),
}) {}
