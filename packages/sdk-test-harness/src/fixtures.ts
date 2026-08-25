import type { Json } from "./types";

/**
 * Deterministic fixture data shared by every conformance suite. All values are
 * stable across languages: no floats beyond JSON-safe precision, string
 * timestamps, and fixed identifiers.
 */

type JsonObject = { readonly [key: string]: Json };
type MutableJsonObject = { [key: string]: Json };

/**
 * Wraps list items in the pagination envelope every collection endpoint
 * returns: `{ data, pageInfo }`. Fixtures are single-page, so `endCursor` is
 * null and `hasNextPage` is false.
 */
const listEnvelope = (items: ReadonlyArray<Json>): Json => ({
  data: items,
  pageInfo: { endCursor: null, hasNextPage: false },
});

export const API_SECRET_KEY = "sk_test_conformance_7f3a91b2";
/**
 * A syntactically valid secret key the server rejects as unknown. Used by
 * auth-negative steps: typed SDK runners create a second client instance with
 * it and assert the 401 surfaces.
 */
export const INVALID_API_SECRET_KEY = "sk_test_conformance_deadbeef";
export const PUBLISHABLE_KEY = "pk_test_conformance_c41d88";

export const DISTINCT_ID = "user_conformance_001";
export const MISSING_PERSON_ID = "person_conformance_missing";
export const PERSON_ID = "person_conformance_001";
export const PRODUCT_ID = "prod_monthly";
export const PRODUCT_SLUG = "monthly_sub";

/** Stable identifiers shared by suites and typed runners. */
export const ORGANIZATION_ID = "org_conformance_001";
export const PROJECT_ID = "proj_conformance_001";
export const API_KEY_ID = "ak_conformance_001";
export const PERK_ID = "perk_conformance_001";
export const PAYWALL_LOCATION_ID = "loc_conformance_001";
export const PRODUCT_PERK_ID = "product_perk_conformance_001";
export const PAYMENT_PROVIDER_CONFIGURATION_ID = "ppc_conformance_001";
export const PAYMENT_PROVIDER_PRODUCT_ID = "ppp_conformance_001";
export const WEBHOOK_ENDPOINT_ID = "wh_conformance_001";
export const WEBHOOK_DELIVERY_ID = "del_conformance_001";
export const DEPLOY_ID = "deploy_conformance_001";
export const DEPLOY_BLOB_SHA256 =
  "3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea";
export const PUSH_SEND_ID = "push_send_conformance_001";
export const PUSH_NOTIFICATION_CONFIGURATION_ID = "pnc_conformance_001";
export const NOTIFICATION_DELIVERY_ID = "pnd_conformance_001";
export const PAYWALL_ID = "pw_conformance_001";
export const PAYWALL_SLUG = "conformance-paywall";
export const PAYWALL_RELEASE_ID = "pwr_conformance_001";
export const PAYWALL_LOCATION_SHOWING_ID = "showing_conformance_002";
export const FEATURE_FLAG_ID = "ff_conformance_001";
export const FEATURE_FLAG_SLUG = "conformance_flag";
export const FEATURE_FLAG_VARIANT_ID = "ffv_conformance_001";
export const FEATURE_FLAG_VARIANT_KEY = "treatment";
export const FEATURE_FLAG_OVERRIDE_ID = "ffo_conformance_001";
export const FEATURE_FLAG_TARGET_ID = "fft_conformance_001";
export const EXPERIMENT_ID = "exp_conformance_001";
export const EXPERIMENT_BACKING_FLAG_ID = "ff_conformance_backing_001";
export const EXPERIMENT_CONTROL_VARIANT_ID = "expvar_conformance_control";
export const EXPERIMENT_TREATMENT_VARIANT_ID = "expvar_conformance_treatment";
export const EXPERIMENT_TREATMENT_ID = "exptr_conformance_001";
export const INGEST_BUILTIN_EVENT_KEY = "revenue";
export const BLOCKED_CUSTOM_EVENT_NAME = "conformance_custom_event";
export const DEVELOPMENT_SUBSCRIPTION_ID = "devsub_conformance_001";
export const DEVELOPMENT_LIFECYCLE_ACTION_ID = "devact_conformance_001";

/** Shared row timestamps: create time, mutation time, and lifecycle end time. */
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const UPDATED_AT = "2026-01-02T00:00:00.000Z";
const ENDED_AT = "2026-01-03T00:00:00.000Z";

/** Schema payload served by both `/api/v1/schema` and `/api/v1/sdk/schema`. */
export const SCHEMA_FIXTURE: Json = {
  version: "sha256:conformance",
  perks: {
    "all-access": { slug: "all-access", name: "All Access" },
  },
  locations: {
    onboarding: { slug: "onboarding", name: "Onboarding" },
  },
  products: {
    monthly_sub: {
      duration: "monthly",
      id: PRODUCT_ID,
      slug: PRODUCT_SLUG,
      type: "subscription",
      properties: { name: "Monthly" },
      configuration: {
        perks: { "all-access": true },
        providers: {
          appleAppStore: { productId: "com.voidhash.monthly.ios" },
          development: {
            currencyCode: "USD",
            duration: "monthly",
            period: "month",
            periodCount: 1,
            price: 9.99,
            priceInMinorUnits: 999,
            productId: PRODUCT_SLUG,
            warning: null,
          },
          googlePlay: { productId: "com.voidhash.monthly.android" },
        },
      },
    },
  },
};

/** `GET /api/v1/products` response. */
export const API_PRODUCTS_FIXTURE: Json = listEnvelope([
  {
    duration: "monthly",
    id: PRODUCT_ID,
    name: "Monthly",
    projectId: "proj_conformance_001",
    slug: PRODUCT_SLUG,
    type: "subscription",
  },
]);

const personAttributes = (email: string | null, name: string | null): Json => ({
  distinctId: DISTINCT_ID,
  email,
  name,
  personId: PERSON_ID,
});

/** Single-person responses across `/api/v1/persons`. */
export const API_PERSON_FIXTURE: Json = personAttributes("user@example.com", "Conformance User");

/** Full `SdkPerson` payload served by the mobile sdk endpoints. */
export const SDK_PERSON_FIXTURE: Json = {
  distinctId: DISTINCT_ID,
  email: "user@example.com",
  entitlements: {
    grants: [
      {
        expiresAt: null,
        perkId: "all-access",
        source: "purchase",
        sourceId: "purchase_conformance_001",
        sourcePersonId: PERSON_ID,
        status: "active",
      },
    ],
  },
  name: "Conformance User",
  personId: PERSON_ID,
  purchases: {
    history: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        productId: PRODUCT_ID,
        providerKey: "development",
        purchaseId: "purchase_conformance_001",
        sourcePersonId: PERSON_ID,
        type: "subscription",
      },
    ],
  },
  snapshotContext: {
    includedPersonIds: [PERSON_ID],
    migrationJobId: null,
    mode: "persisted",
  },
  subscriptions: {
    current: {
      expiresAt: "2027-01-01T00:00:00.000Z",
      productId: PRODUCT_ID,
      status: "active",
      subscriptionId: "sub_conformance_001",
    },
    history: [],
  },
};

/** `/api/v1/sdk/evaluate-flags` response (already in SDK-normalized shape). */
export const FEATURE_FLAGS_FIXTURE: Json = {
  flags: [
    { enabled: true, key: "new_paywall", variantKey: null },
    { enabled: false, key: "legacy_flow", variantKey: null },
  ],
};

/** `/api/v1/sdk/resolve-paywall` response. */
export const RESOLVED_PAYWALL_FIXTURE: Json = {
  location: {
    id: "loc_onboarding",
    name: "Onboarding",
    slug: "onboarding",
  },
  showing: {
    id: "showing_conformance_001",
    paywall: {
      id: "pw_onboarding",
      name: "Onboarding Paywall",
      slug: "onboarding",
    },
    paywallId: "pw_onboarding",
    paywallRelease: {
      htmlUrl: "https://cdn.conformance.voidhash.test/onboarding/index.html",
      publishedAt: "2026-01-01T00:00:00.000Z",
      releaseId: "release_conformance_001",
      runtime: {
        contentHash: "sha256:conformance-release",
        productSlugs: [PRODUCT_SLUG],
        variables: {},
      },
    },
    paywallReleaseId: "release_conformance_001",
    startedAt: "2026-01-01T00:00:00.000Z",
    type: "paywall_release",
  },
};

/** `/api/v1/sdk/sync-transaction` request body expectation. */
export const SYNC_TRANSACTION_REQUEST_FIXTURE: Json = {
  appAccountToken: null,
  platform: "ios",
  providerProductId: "com.voidhash.monthly.ios",
  productSlug: PRODUCT_SLUG,
  purchaseDate: 1767225600000,
  purchaseToken: null,
  quantity: 1,
  receipt: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A-conformance-receipt",
  transactionId: "txn_conformance_001",
};

/** `/api/v1/sdk/sync-transaction` response. */
export const SYNC_TRANSACTION_RESPONSE_FIXTURE: Json = { accepted: true };

/** `/api/v1/sdk/development/purchase` request body expectation. */
export const DEVELOPMENT_PURCHASE_REQUEST_FIXTURE: Json = {
  devTransactionId: "dev_conformance_001",
  productSlug: PRODUCT_SLUG,
  purchaseDate: 1767225600000,
  quantity: 1,
};

/** `/api/v1/sdk/development/purchase` response. */
export const DEVELOPMENT_PURCHASE_RESPONSE_FIXTURE: Json = { accepted: true, warning: null };

/** Error payloads served for error-mapping steps. */
export const NOT_AUTHENTICATED_ERROR_FIXTURE: Json = {
  _tag: "Api/NotAuthenticatedError",
  message: "Not authenticated.",
};

export const SDK_PERSON_NOT_FOUND_ERROR_FIXTURE: Json = {
  _tag: "Api/SdkPersonNotFoundError",
  message: "Person not found.",
};

export const ACTION_FORBIDDEN_ERROR_FIXTURE: Json = {
  _tag: "Api/ActionForbiddenError",
  message: "Forbidden.",
};

export const PERSON_NOT_FOUND_ERROR_FIXTURE: Json = {
  _tag: "Api/PersonNotFoundError",
  message: "Person not found.",
};

export const API_KEY_NOT_FOUND_ERROR_FIXTURE: Json = {
  _tag: "Api/ApiKeyNotFoundError",
  message: "API key not found.",
};

export const WEBHOOK_ENDPOINT_NOT_FOUND_ERROR_FIXTURE: Json = {
  _tag: "Api/WebhookEndpointNotFoundError",
  message: "Webhook endpoint not found.",
};

export const WEBHOOK_VALIDATION_ERROR_FIXTURE: Json = {
  _tag: "Api/WebhookValidationError",
  message: "Invalid webhook configuration.",
};

export const PUSH_SEND_NOT_ENABLED_ERROR_FIXTURE: Json = {
  _tag: "Api/PushSendNotEnabledError",
  message: "Push notifications are not enabled for this organization.",
};

export const INCOMPLETE_DEPLOY_ERROR_FIXTURE: Json = {
  _tag: "Api/IncompleteDeployError",
  message: "Deploy is missing declared blobs.",
};

export const DEPLOY_BLOB_HASH_MISMATCH_ERROR_FIXTURE: Json = {
  _tag: "Api/DeployBlobHashMismatchError",
  message: "Uploaded blob does not match the declared sha256.",
};

// ---------------------------------------------------------------------------
// Management-API (secret-key) resource fixtures
// ---------------------------------------------------------------------------

/** `/api/v1/auth/session` response. */
export const SESSION_FIXTURE: Json = {
  method: "secret-key",
  name: "Conformance Key",
  organizations: [
    { id: ORGANIZATION_ID, name: "Conformance Org", slug: "conformance-org" },
  ],
  projects: [
    { id: PROJECT_ID, name: "Conformance Project", organizationId: ORGANIZATION_ID, slug: "conformance-project" },
  ],
};

const apiKeyAttributes = (rawKey?: string): Json => {
  const attributes: MutableJsonObject = {
    end: "b2",
    id: API_KEY_ID,
    isPublic: false,
    name: "Conformance Secret Key",
    prefix: "sk_test_conformance_7f3a91b",
    projectId: PROJECT_ID,
  };
  if (rawKey !== undefined) {
    attributes.rawKey = rawKey;
  }
  return attributes;
};

/** `/api/v1/api-keys` responses without the raw key. */
export const API_KEY_FIXTURE: Json = apiKeyAttributes();

/** Create/rotate responses, which include the raw key exactly once. */
export const API_KEY_WITH_RAW_KEY_FIXTURE: Json = apiKeyAttributes("sk_test_conformance_raw_b2");

/** `GET /api/v1/persons` list response. */
export const API_PERSONS_LIST_FIXTURE: Json = listEnvelope([API_PERSON_FIXTURE]);

const entitlementGrant: Json = {
  expiresAt: null,
  perkId: "all-access",
  source: "purchase",
  sourceId: "purchase_conformance_001",
  sourcePersonId: PERSON_ID,
  status: "active",
};

/** `/api/v1/persons/:personId/entitlements` response. */
export const PERSON_ENTITLEMENTS_FIXTURE: Json = { grants: [entitlementGrant] };

/** `/api/v1/schema/version` response. */
export const SCHEMA_VERSION_FIXTURE: Json = { version: "sha256:conformance-schema" };

/**
 * `/api/v1/schema` response — the CLI-facing consolidated projection. Distinct
 * from {@link SCHEMA_FIXTURE}, which is the SDK runtime shape.
 */
export const PROJECT_SCHEMA_FIXTURE: Json = {
  enabledProviders: ["appleAppStore", "googlePlay"],
  locations: [{ description: null, name: "Onboarding", slug: "onboarding" }],
  perks: [{ name: "All Access", slug: "all-access" }],
  products: [
    {
      duration: "monthly",
      name: "Monthly",
      perks: ["all-access"],
      providers: [
        {
          configuration: { productId: "com.voidhash.monthly.ios" },
          providerId: "appleAppStore",
        },
        {
          configuration: { productId: "com.voidhash.monthly.android" },
          providerId: "googlePlay",
        },
      ],
      slug: PRODUCT_SLUG,
      type: "subscription",
    },
  ],
  version: "sha256:conformance-schema",
};

/** `/api/v1/organizations` create response. */
export const ORGANIZATION_FIXTURE: Json = {
  id: ORGANIZATION_ID,
  name: "Conformance Org",
  slug: "conformance-org",
};

/** `/api/v1/projects` create response. */
export const PROJECT_FIXTURE: Json = {
  id: PROJECT_ID,
  name: "Conformance Project",
  slug: "conformance-project",
};

/** `GET /api/v1/organizations/:organizationId/projects` list response. */
export const PROJECTS_LIST_FIXTURE: Json = listEnvelope([PROJECT_FIXTURE]);

/** Single perk payload shared by the perk CRUD steps and the perks listing. */
export const PERK_FIXTURE: Json = {
  id: PERK_ID,
  name: "All Access",
  projectId: PROJECT_ID,
  slug: "all-access",
};

/** `PATCH /api/v1/perks/:perkId` response after the rename step. */
export const PERK_RENAMED_FIXTURE: Json = {
  id: PERK_ID,
  name: "All Access Plus",
  projectId: PROJECT_ID,
  slug: "all-access",
};

/** `GET /api/v1/perks` list response. */
export const PERKS_LIST_FIXTURE: Json = listEnvelope([PERK_FIXTURE]);

/** Single paywall-location payload shared by the location CRUD steps. */
export const PAYWALL_LOCATION_FIXTURE: Json = {
  description: null,
  id: PAYWALL_LOCATION_ID,
  name: "Onboarding",
  projectId: PROJECT_ID,
  slug: "onboarding",
};

/** `GET /api/v1/paywall-locations` list response. */
export const PAYWALL_LOCATIONS_LIST_FIXTURE: Json = listEnvelope([PAYWALL_LOCATION_FIXTURE]);

/** Single product↔perk attachment payload. */
export const PRODUCT_PERK_FIXTURE: Json = {
  id: PRODUCT_PERK_ID,
  perkId: PERK_ID,
  productId: PRODUCT_ID,
};

/** `GET /api/v1/products/:productId/perks` list response. */
export const PRODUCT_PERKS_LIST_FIXTURE: Json = listEnvelope([PRODUCT_PERK_FIXTURE]);

/** `GET /api/v1/payment-provider-configurations` list response. */
export const PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE: Json = listEnvelope([
  {
    enabled: true,
    id: PAYMENT_PROVIDER_CONFIGURATION_ID,
    name: "App Store",
    projectId: PROJECT_ID,
    providerId: "apple-app-store",
  },
]);

/** `GET /api/v1/payment-provider-products` list response. */
export const PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE: Json = listEnvelope([
  {
    configuration: { productId: "com.voidhash.monthly.ios" },
    id: "ppp_conformance_001",
    paymentProviderConfigurationId: PAYMENT_PROVIDER_CONFIGURATION_ID,
    productId: PRODUCT_ID,
    providerId: "apple-app-store",
  },
]);

const webhookEndpointAttributes = (overrides: JsonObject = {}): Json => ({
  consecutiveFailures: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  events: ["purchase.completed", "subscription.created"],
  id: WEBHOOK_ENDPOINT_ID,
  lastSuccessAt: null,
  name: "Conformance Endpoint",
  projectId: PROJECT_ID,
  secret: "whsec_conformance_001",
  status: "active",
  url: "https://hooks.conformance.voidhash.test/receive",
  ...overrides,
});

/** Webhook endpoint payload shared by create/get/update/rotate responses. */
export const WEBHOOK_ENDPOINT_FIXTURE: Json = webhookEndpointAttributes();

/** Update response — status flipped to disabled by the suite's PATCH step. */
export const WEBHOOK_ENDPOINT_DISABLED_FIXTURE: Json = webhookEndpointAttributes({
  description: "Rotated",
  status: "disabled",
});

const webhookDeliveryAttempt: Json = {
  attemptNumber: 1,
  createdAt: "2026-01-01T00:01:00.000Z",
  durationMs: 42,
  errorMessage: null,
  id: "attempt_conformance_001",
  responseBody: "ok",
  statusCode: 200,
  succeeded: true,
};

const webhookDeliveryAttributes = (withAttempts: boolean): Json => {
  const attributes: MutableJsonObject = {
    attemptCount: 1,
    completedAt: "2026-01-01T00:01:00.000Z",
    createdAt: "2026-01-01T00:00:30.000Z",
    eventOccurredAt: "2026-01-01T00:00:00.000Z",
    eventType: "purchase.completed",
    id: WEBHOOK_DELIVERY_ID,
    maxAttempts: 5,
    nextAttemptAt: null,
    payload: { type: "purchase.completed", object: { productId: PRODUCT_ID } },
    projectId: PROJECT_ID,
    status: "succeeded",
    webhookEndpointId: WEBHOOK_ENDPOINT_ID,
  };
  if (withAttempts) {
    attributes.attempts = [webhookDeliveryAttempt];
  }
  return attributes;
};

/** `/api/v1/webhooks/deliveries` list + retry responses. */
export const WEBHOOK_DELIVERY_FIXTURE: Json = webhookDeliveryAttributes(false);

/** `/api/v1/webhooks/deliveries/:deliveryId` response including attempts. */
export const WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE: Json =
  webhookDeliveryAttributes(true);

/** `POST /api/v1/notifications` (202) success response. */
export const SEND_NOTIFICATION_RESPONSE_FIXTURE: Json = {
  deviceCount: 2,
  pushNotificationSendId: PUSH_SEND_ID,
  status: "pending",
  unresolvedDistinctIds: [],
};

/** `POST /api/v1/paywall-deploys` (201) response. */
export const CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE: Json = {
  deployId: DEPLOY_ID,
  missing: [DEPLOY_BLOB_SHA256],
};

/** Blob upload response — an empty JSON object per deploy contract §4.2. */
export const UPLOAD_PAYWALL_DEPLOY_BLOB_RESPONSE_FIXTURE: Json = {};

// ---------------------------------------------------------------------------
// Tenancy management (organizations & projects)
// ---------------------------------------------------------------------------

/** `GET /api/v1/organizations` list response. */
export const ORGANIZATIONS_LIST_FIXTURE: Json = listEnvelope([ORGANIZATION_FIXTURE]);

/** `PATCH /api/v1/organizations/:organizationId` response after the rename. */
export const ORGANIZATION_RENAMED_FIXTURE: Json = {
  id: ORGANIZATION_ID,
  name: "Conformance Org Renamed",
  slug: "conformance-org",
};

/** `PATCH /api/v1/projects/:projectId` response after the rename. */
export const PROJECT_RENAMED_FIXTURE: Json = {
  id: PROJECT_ID,
  name: "Conformance Project Renamed",
  slug: "conformance-project",
};

// ---------------------------------------------------------------------------
// Product & perk management
// ---------------------------------------------------------------------------

/** Single-product responses of the product CRUD steps (create/get). */
export const PRODUCT_DETAIL_FIXTURE: Json = {
  duration: 30,
  id: PRODUCT_ID,
  name: "Monthly",
  projectId: PROJECT_ID,
  slug: PRODUCT_SLUG,
  type: "subscription",
};

/** `PATCH /api/v1/products/:productId` response after the rename. */
export const PRODUCT_RENAMED_FIXTURE: Json = {
  duration: 30,
  id: PRODUCT_ID,
  name: "Monthly Plus",
  projectId: PROJECT_ID,
  slug: PRODUCT_SLUG,
  type: "subscription",
};

// ---------------------------------------------------------------------------
// Payment provider management (detail shapes)
// ---------------------------------------------------------------------------

const paymentProviderConfigurationDetail = (overrides: JsonObject = {}): Json => ({
  activeProviderId: null,
  configurationPresence: { hasSecretKey: false },
  createdAt: CREATED_AT,
  enabled: false,
  id: PAYMENT_PROVIDER_CONFIGURATION_ID,
  name: "Stripe",
  paymentProviderKey: "stripe",
  projectId: PROJECT_ID,
  providerId: "stripe",
  updatedAt: null,
  ...overrides,
});

/** Create/get responses of `/api/v1/payment-provider-configurations/:id`. */
export const PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE: Json =
  paymentProviderConfigurationDetail();

/** Update response — credentials stored, configuration enabled and renamed. */
export const PAYMENT_PROVIDER_CONFIGURATION_ENABLED_FIXTURE: Json =
  paymentProviderConfigurationDetail({
    configurationPresence: { hasSecretKey: true },
    enabled: true,
    name: "Stripe Production",
    updatedAt: UPDATED_AT,
  });

const paymentProviderProductDetail = (overrides: JsonObject = {}): Json => ({
  configuration: { productId: "price_conformance_001" },
  createdAt: CREATED_AT,
  id: PAYMENT_PROVIDER_PRODUCT_ID,
  isActive: false,
  paymentProviderConfigurationId: PAYMENT_PROVIDER_CONFIGURATION_ID,
  productId: PRODUCT_ID,
  providerProductKey: "stripe",
  updatedAt: null,
  ...overrides,
});

/** Create/get responses of `/api/v1/payment-provider-products/:mappingId`. */
export const PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE: Json = paymentProviderProductDetail();

/** Update response — configuration replaced wholesale. */
export const PAYMENT_PROVIDER_PRODUCT_UPDATED_FIXTURE: Json = paymentProviderProductDetail({
  configuration: { productId: "price_conformance_002" },
  updatedAt: UPDATED_AT,
});

/** Activate response — the mapping now serves live traffic. */
export const PAYMENT_PROVIDER_PRODUCT_ACTIVE_FIXTURE: Json = paymentProviderProductDetail({
  configuration: { productId: "price_conformance_002" },
  isActive: true,
  updatedAt: UPDATED_AT,
});

// ---------------------------------------------------------------------------
// Paywalls & releases
// ---------------------------------------------------------------------------

const paywallAttributes = (overrides: JsonObject = {}): Json => ({
  archivedAt: null,
  createdAt: CREATED_AT,
  id: PAYWALL_ID,
  name: "Conformance Paywall",
  projectId: PROJECT_ID,
  slug: PAYWALL_SLUG,
  thumbnailUrl: null,
  ...overrides,
});

/** Create/get responses of `/api/v1/paywalls/:paywallId`. */
export const PAYWALL_FIXTURE: Json = paywallAttributes();

/** Update/restore responses after the rename step. */
export const PAYWALL_RENAMED_FIXTURE: Json = paywallAttributes({
  name: "Conformance Paywall v2",
});

/** `GET /api/v1/paywalls` list response. */
export const PAYWALLS_LIST_FIXTURE: Json = listEnvelope([PAYWALL_RENAMED_FIXTURE]);

const PAYWALL_RELEASE_URL =
  "https://cdn.conformance.voidhash.test/conformance-paywall/index.html";

const paywallReleaseAttributes = (overrides: JsonObject = {}): Json => ({
  createdAt: CREATED_AT,
  paywallId: PAYWALL_ID,
  publishedAt: null,
  releaseId: PAYWALL_RELEASE_ID,
  status: "draft",
  url: PAYWALL_RELEASE_URL,
  version: 1,
  ...overrides,
});

/** `POST /api/v1/paywalls/:paywallId/releases` (201) response. */
export const PAYWALL_RELEASE_DRAFT_FIXTURE: Json = paywallReleaseAttributes();

/** `GET /api/v1/paywalls/:paywallId/releases` list response. */
export const PAYWALL_RELEASES_LIST_FIXTURE: Json = listEnvelope([PAYWALL_RELEASE_DRAFT_FIXTURE]);

/** Publish response — the draft became the immutable published artifact. */
export const PAYWALL_RELEASE_PUBLISHED_FIXTURE: Json = paywallReleaseAttributes({
  publishedAt: UPDATED_AT,
  status: "published",
});

/** Activate response — identity of the now-active release. */
export const ACTIVATED_PAYWALL_RELEASE_FIXTURE: Json = {
  releaseId: PAYWALL_RELEASE_ID,
  version: 1,
};

// ---------------------------------------------------------------------------
// Paywall locations (writes & showings)
// ---------------------------------------------------------------------------

/** `PATCH /api/v1/paywall-locations/:locationId` response after the update. */
export const PAYWALL_LOCATION_RENAMED_FIXTURE: Json = {
  description: "Shown after signup",
  id: PAYWALL_LOCATION_ID,
  name: "Onboarding Updated",
  projectId: PROJECT_ID,
  slug: "onboarding",
};

/** `PUT /api/v1/paywall-locations/:locationId/showing` response. */
export const PAYWALL_LOCATION_SHOWING_FIXTURE: Json = {
  createdAt: UPDATED_AT,
  createdByUserId: null,
  endedAt: null,
  featureFlagId: null,
  id: PAYWALL_LOCATION_SHOWING_ID,
  paywall: { id: PAYWALL_ID, name: "Conformance Paywall v2", slug: PAYWALL_SLUG },
  paywallId: PAYWALL_ID,
  paywallLocationId: PAYWALL_LOCATION_ID,
  paywallRelease: {
    htmlUrl: PAYWALL_RELEASE_URL,
    publishedAt: UPDATED_AT,
    releaseId: PAYWALL_RELEASE_ID,
    version: 1,
  },
  paywallReleaseId: PAYWALL_RELEASE_ID,
  projectId: PROJECT_ID,
  startedAt: UPDATED_AT,
  type: "paywall_release",
  updatedAt: null,
};

/** `GET /api/v1/paywall-locations/:locationId/showings` list response. */
export const PAYWALL_LOCATION_SHOWINGS_LIST_FIXTURE: Json = listEnvelope([
  PAYWALL_LOCATION_SHOWING_FIXTURE,
]);

// ---------------------------------------------------------------------------
// Paywall deploys (read side)
// ---------------------------------------------------------------------------

/** Single deploy row served by `/api/v1/paywall-deploys/:deployId`. */
export const PAYWALL_DEPLOY_FIXTURE: Json = {
  cliVersion: "0.1.0",
  components: [
    {
      componentId: "component_conformance_001",
      contentHash: DEPLOY_BLOB_SHA256,
      slug: "hero",
      version: 3,
    },
  ],
  createdAt: CREATED_AT,
  createdByName: "Conformance Key",
  id: DEPLOY_ID,
  paywalls: [
    {
      contentHash: DEPLOY_BLOB_SHA256,
      releaseId: "release_conformance_001",
      slug: "onboarding",
      version: 2,
    },
  ],
  runtimeVersion: "1.0.0",
  schemaVersion: 1,
  status: "ready",
};

/** `GET /api/v1/paywall-deploys` list response. */
export const PAYWALL_DEPLOYS_LIST_FIXTURE: Json = listEnvelope([PAYWALL_DEPLOY_FIXTURE]);

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

const featureFlagAttributes = (overrides: JsonObject = {}): Json => ({
  archivedAt: null,
  createdAt: CREATED_AT,
  description: null,
  enabled: false,
  id: FEATURE_FLAG_ID,
  overrides: [],
  projectId: PROJECT_ID,
  rolloutBps: 0,
  slug: FEATURE_FLAG_SLUG,
  targets: [],
  type: "boolean",
  updatedAt: null,
  variants: [],
  version: 1,
  ...overrides,
});

/** Create/get responses of `/api/v1/feature-flags/:featureFlagId`. */
export const FEATURE_FLAG_FIXTURE: Json = featureFlagAttributes();

/** Update response — flag enabled with a 50% rollout. */
export const FEATURE_FLAG_ENABLED_FIXTURE: Json = featureFlagAttributes({
  enabled: true,
  rolloutBps: 5000,
  updatedAt: UPDATED_AT,
  version: 2,
});

const featureFlagVariant: Json = {
  archivedAt: null,
  createdAt: UPDATED_AT,
  featureFlagId: FEATURE_FLAG_ID,
  id: FEATURE_FLAG_VARIANT_ID,
  key: FEATURE_FLAG_VARIANT_KEY,
  label: "Treatment",
  updatedAt: null,
  value: true,
  weightBps: 10000,
};

/** Variant-replacement and restore responses: the flag with its variant matrix. */
export const FEATURE_FLAG_WITH_VARIANTS_FIXTURE: Json = featureFlagAttributes({
  enabled: true,
  rolloutBps: 5000,
  updatedAt: UPDATED_AT,
  variants: [featureFlagVariant],
  version: 3,
});

/** `GET /api/v1/feature-flags` list response (collection projection). */
export const FEATURE_FLAGS_LIST_FIXTURE: Json = listEnvelope([
  {
    archivedAt: null,
    createdAt: CREATED_AT,
    description: null,
    enabled: true,
    id: FEATURE_FLAG_ID,
    projectId: PROJECT_ID,
    rolloutBps: 5000,
    slug: FEATURE_FLAG_SLUG,
    type: "boolean",
    updatedAt: UPDATED_AT,
    variantCount: 1,
    version: 3,
  },
]);

/** `POST /api/v1/feature-flags/evaluate` response. */
export const EVALUATED_FEATURE_FLAGS_FIXTURE: Json = {
  flags: [
    {
      enabled: true,
      key: FEATURE_FLAG_SLUG,
      payload: null,
      variantKey: FEATURE_FLAG_VARIANT_KEY,
    },
  ],
};

/** `POST /api/v1/feature-flag-overrides` (201) upsert response. */
export const FEATURE_FLAG_OVERRIDE_FIXTURE: Json = {
  archivedAt: null,
  createdAt: CREATED_AT,
  featureFlagId: FEATURE_FLAG_ID,
  forcedEnabled: true,
  forcedVariantKey: null,
  id: FEATURE_FLAG_OVERRIDE_ID,
  identityType: 2,
  identityValue: DISTINCT_ID,
  note: null,
  updatedAt: null,
};

/** `GET /api/v1/feature-flag-overrides` list response. */
export const FEATURE_FLAG_OVERRIDES_LIST_FIXTURE: Json = listEnvelope([
  FEATURE_FLAG_OVERRIDE_FIXTURE,
]);

/** `POST /api/v1/feature-flag-targets` (201) upsert response. */
export const FEATURE_FLAG_TARGET_FIXTURE: Json = {
  archivedAt: null,
  createdAt: CREATED_AT,
  featureFlagId: FEATURE_FLAG_ID,
  id: FEATURE_FLAG_TARGET_ID,
  identityType: 2,
  identityValue: DISTINCT_ID,
  listType: 1,
  updatedAt: null,
};

/** `GET /api/v1/feature-flag-targets` list response. */
export const FEATURE_FLAG_TARGETS_LIST_FIXTURE: Json = listEnvelope([
  FEATURE_FLAG_TARGET_FIXTURE,
]);

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

const experimentControlVariant: Json = {
  archivedAt: null,
  createdAt: CREATED_AT,
  experimentId: EXPERIMENT_ID,
  id: EXPERIMENT_CONTROL_VARIANT_ID,
  isControl: true,
  name: "Control",
  updatedAt: null,
  weightBps: 5000,
};

const experimentTreatmentVariant: Json = {
  archivedAt: null,
  createdAt: CREATED_AT,
  experimentId: EXPERIMENT_ID,
  id: EXPERIMENT_TREATMENT_VARIANT_ID,
  isControl: false,
  name: "Treatment",
  updatedAt: null,
  weightBps: 5000,
};

const experimentTreatment: Json = {
  archivedAt: null,
  config: { paywallId: PAYWALL_ID, paywallLocationId: PAYWALL_LOCATION_ID },
  createdAt: UPDATED_AT,
  experimentId: EXPERIMENT_ID,
  id: EXPERIMENT_TREATMENT_ID,
  treatmentType: "paywall",
  updatedAt: null,
  variantId: EXPERIMENT_TREATMENT_VARIANT_ID,
};

const experimentAttributes = (overrides: JsonObject = {}): Json => ({
  archivedAt: null,
  backingFlag: {
    enabled: false,
    id: EXPERIMENT_BACKING_FLAG_ID,
    key: "experiment_conformance",
    rolloutBps: 0,
  },
  createdAt: CREATED_AT,
  createdByUserId: null,
  description: null,
  endedAt: null,
  featureFlagId: EXPERIMENT_BACKING_FLAG_ID,
  hypothesis: null,
  id: EXPERIMENT_ID,
  name: "Conformance Experiment",
  primaryMetricEventName: null,
  projectId: PROJECT_ID,
  secondaryMetricEventNames: null,
  startedAt: null,
  status: "draft",
  treatments: [],
  updatedAt: null,
  updatedByUserId: null,
  variants: [experimentControlVariant, experimentTreatmentVariant],
  version: 1,
  winningVariantId: null,
  ...overrides,
});

/** Create/get responses: a fresh draft with the seeded 50/50 variant pair. */
export const EXPERIMENT_DRAFT_FIXTURE: Json = experimentAttributes();

const experimentConfiguredOverrides: JsonObject = {
  description: "Conformance experiment",
  hypothesis: "Treatment converts better",
  primaryMetricEventName: "$purchase",
  treatments: [experimentTreatment],
  updatedAt: UPDATED_AT,
};

/** Update response — metrics and the variant matrix are authored. */
export const EXPERIMENT_CONFIGURED_FIXTURE: Json = experimentAttributes({
  ...experimentConfiguredOverrides,
  version: 2,
});

/** Start response. */
export const EXPERIMENT_RUNNING_FIXTURE: Json = experimentAttributes({
  ...experimentConfiguredOverrides,
  startedAt: UPDATED_AT,
  status: "running",
  version: 3,
});

/** Pause response. */
export const EXPERIMENT_PAUSED_FIXTURE: Json = experimentAttributes({
  ...experimentConfiguredOverrides,
  startedAt: UPDATED_AT,
  status: "paused",
  version: 4,
});

/** Conclude/restore responses — the treatment arm won. */
export const EXPERIMENT_CONCLUDED_FIXTURE: Json = experimentAttributes({
  ...experimentConfiguredOverrides,
  endedAt: ENDED_AT,
  startedAt: UPDATED_AT,
  status: "concluded",
  version: 5,
  winningVariantId: EXPERIMENT_TREATMENT_VARIANT_ID,
});

/** `GET /api/v1/experiments` list response (collection projection). */
export const EXPERIMENTS_LIST_FIXTURE: Json = listEnvelope([
  {
    archivedAt: null,
    createdAt: CREATED_AT,
    createdByUserId: null,
    description: "Conformance experiment",
    endedAt: ENDED_AT,
    featureFlagId: EXPERIMENT_BACKING_FLAG_ID,
    hypothesis: "Treatment converts better",
    id: EXPERIMENT_ID,
    name: "Conformance Experiment",
    paywallLocationIds: [PAYWALL_LOCATION_ID],
    primaryMetricEventName: "$purchase",
    projectId: PROJECT_ID,
    secondaryMetricEventNames: null,
    startedAt: UPDATED_AT,
    status: "concluded",
    updatedAt: UPDATED_AT,
    updatedByUserId: null,
    variantCount: 2,
    version: 5,
    winningVariantId: EXPERIMENT_TREATMENT_VARIANT_ID,
  },
]);

/** `GET /api/v1/experiments/:experimentId/results` response. */
export const EXPERIMENT_RESULTS_FIXTURE: Json = {
  variants: [
    {
      conversionRate: 0.1,
      conversions: 10,
      exposures: 100,
      revenueUsd: 99.9,
      variantKey: EXPERIMENT_CONTROL_VARIANT_ID,
    },
    {
      conversionRate: 0.2,
      conversions: 20,
      exposures: 100,
      revenueUsd: 199.8,
      variantKey: EXPERIMENT_TREATMENT_VARIANT_ID,
    },
  ],
};

// ---------------------------------------------------------------------------
// Analytics: insights, captured events, ingest policy
// ---------------------------------------------------------------------------

/** `POST /api/v1/analytics/queries/insights` response. */
export const QUERY_INSIGHTS_RESULT_FIXTURE: Json = {
  results: [
    {
      insightId: "builtin/revenue",
      key: "revenue",
      resolvedTimeRange: {
        end: "2026-01-01T00:00:00.000Z",
        start: "2025-12-02T00:00:00.000Z",
      },
      result: {
        kind: "metric",
        sparkline: [
          { timestamp: "2025-12-31T00:00:00.000Z", value: 120.5 },
          { timestamp: "2026-01-01T00:00:00.000Z", value: 99.9 },
        ],
        summary: { currency: "USD", value: 220.4 },
      },
    },
  ],
};

/** `GET /api/v1/events` list response. */
export const EVENTS_LIST_FIXTURE: Json = listEnvelope([
  {
    captureId: "cap_conformance_001",
    context: { sdk: "node" },
    distinctId: DISTINCT_ID,
    eventId: "evt_conformance_analytics_001",
    eventName: "$purchase",
    identityMode: "identified",
    personId: PERSON_ID,
    previousDistinctId: null,
    processedAt: UPDATED_AT,
    properties: { revenue: 9.99 },
    receivedAt: UPDATED_AT,
    requestId: "req_conformance_001",
    source: "sdk",
    timestamp: CREATED_AT,
  },
]);

const ingestPolicyAttributes = (
  enabled: boolean,
  override: Json,
  customEventBlocklist: ReadonlyArray<Json>,
): Json => ({
  builtinEvents: [
    {
      defaultEnabled: true,
      description: "Revenue events captured from purchases.",
      enabled,
      eventNames: ["$purchase"],
      key: INGEST_BUILTIN_EVENT_KEY,
      name: "Revenue",
      override,
      warning: null,
    },
  ],
  customEventBlocklist,
});

/** `GET /api/v1/ingest-policy` response with no stored overrides. */
export const INGEST_POLICY_FIXTURE: Json = ingestPolicyAttributes(true, null, []);

/** Response after `PUT /ingest-policy/builtin-events/:key` disables the group. */
export const INGEST_POLICY_BUILTIN_DISABLED_FIXTURE: Json = ingestPolicyAttributes(
  false,
  false,
  [],
);

/** Response after `PUT /ingest-policy/custom-events/:eventName` blocks the event. */
export const INGEST_POLICY_CUSTOM_BLOCKED_FIXTURE: Json = ingestPolicyAttributes(false, false, [
  BLOCKED_CUSTOM_EVENT_NAME,
]);

// ---------------------------------------------------------------------------
// Development sandbox
// ---------------------------------------------------------------------------

/** `GET /api/v1/development/settings` response. */
export const DEVELOPMENT_SETTINGS_FIXTURE: Json = { developmentPurchasesEnabled: true };

/** `PATCH /api/v1/development/settings` response after disabling purchases. */
export const DEVELOPMENT_SETTINGS_DISABLED_FIXTURE: Json = {
  developmentPurchasesEnabled: false,
};

/** `GET /api/v1/development/state` response for the conformance person. */
export const DEVELOPMENT_STATE_FIXTURE: Json = {
  developmentPurchasesEnabled: false,
  grants: [
    { expiresAt: null, id: "devgrant_conformance_001", perkId: PERK_ID, status: 1 },
  ],
  purchases: [
    {
      createdAt: CREATED_AT,
      id: "devpurchase_conformance_001",
      productId: PRODUCT_ID,
      productName: "Monthly",
      productSlug: PRODUCT_SLUG,
      refundedAt: null,
      revokedAt: null,
    },
  ],
  subscriptions: [
    {
      canceledAt: null,
      expiresAt: "2027-01-01T00:00:00.000Z",
      gracePeriodExpiresAt: null,
      id: DEVELOPMENT_SUBSCRIPTION_ID,
      productId: PRODUCT_ID,
      productName: "Monthly",
      productSlug: PRODUCT_SLUG,
      startsAt: CREATED_AT,
      status: 1,
    },
  ],
};

/** `POST /api/v1/development/lifecycle-actions` (202) acknowledgement. */
export const DEVELOPMENT_LIFECYCLE_ACTION_ACCEPTED_FIXTURE: Json = {
  actionId: DEVELOPMENT_LIFECYCLE_ACTION_ID,
};

// ---------------------------------------------------------------------------
// Push notification configurations & send history
// ---------------------------------------------------------------------------

const pushNotificationConfigurationAttributes = (overrides: JsonObject = {}): Json => ({
  activeProviderId: null,
  configuration: {},
  createdAt: CREATED_AT,
  deletedAt: null,
  enabled: false,
  id: PUSH_NOTIFICATION_CONFIGURATION_ID,
  name: "Firebase Cloud Messaging",
  projectId: PROJECT_ID,
  providerId: "fcm",
  pushProviderKey: "fcm",
  updatedAt: null,
  ...overrides,
});

/** Create/get responses of `/api/v1/push-notification-configurations/:id`. */
export const PUSH_NOTIFICATION_CONFIGURATION_FIXTURE: Json =
  pushNotificationConfigurationAttributes();

/** Update response — credentials stored, configuration enabled and renamed. */
export const PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE: Json =
  pushNotificationConfigurationAttributes({
    configuration: { hasServiceAccountJson: true },
    enabled: true,
    name: "Conformance FCM",
    updatedAt: UPDATED_AT,
  });

/** `GET /api/v1/push-notification-configurations` list response. */
export const PUSH_NOTIFICATION_CONFIGURATIONS_LIST_FIXTURE: Json = listEnvelope([
  PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE,
]);

/** One push fan-out row of `GET /api/v1/notification-sends`. */
export const NOTIFICATION_SEND_FIXTURE: Json = {
  completedAt: UPDATED_AT,
  createdAt: CREATED_AT,
  deviceCount: 2,
  failedCount: 0,
  id: PUSH_SEND_ID,
  idempotencyKey: null,
  message: { body: "Conformance push", title: "Conformance" },
  messagePurged: false,
  requestedDistinctIdCount: 1,
  requestedPersonCount: 1,
  skippedCount: 0,
  status: "completed",
  succeededCount: 2,
  unresolvedDistinctIds: [],
};

/** `GET /api/v1/notification-sends` list response. */
export const NOTIFICATION_SENDS_LIST_FIXTURE: Json = listEnvelope([NOTIFICATION_SEND_FIXTURE]);

/** One per-device delivery row of `GET /notification-sends/:sendId/deliveries`. */
export const NOTIFICATION_DELIVERY_FIXTURE: Json = {
  attemptCount: 1,
  completedAt: UPDATED_AT,
  createdAt: CREATED_AT,
  id: NOTIFICATION_DELIVERY_ID,
  lastError: null,
  maxAttempts: 5,
  nextAttemptAt: null,
  personId: PERSON_ID,
  provider: "fcm",
  providerMessageId: "fcm_message_conformance_001",
  status: "succeeded",
};

/** `GET /api/v1/notification-sends/:sendId/deliveries` list response. */
export const NOTIFICATION_DELIVERIES_LIST_FIXTURE: Json = listEnvelope([
  NOTIFICATION_DELIVERY_FIXTURE,
]);

/** Finalize response (deploy contract §4.3). */
export const FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE: Json = {
  components: [
    {
      componentId: "component_conformance_001",
      contentHash: DEPLOY_BLOB_SHA256,
      id: "hero",
      version: 3,
    },
  ],
  deployId: DEPLOY_ID,
  paywalls: [
    {
      contentHash: DEPLOY_BLOB_SHA256,
      id: "onboarding",
      paywallId: "pw_onboarding",
      releaseId: "release_conformance_001",
      url: "https://cdn.conformance.voidhash.test/onboarding/index.html",
      version: 2,
    },
  ],
  status: "ready",
};
