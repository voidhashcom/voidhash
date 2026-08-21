import type { Json } from "./types";

/**
 * Deterministic fixture data shared by every conformance suite. All values are
 * stable across languages: no floats beyond JSON-safe precision, string
 * timestamps, and fixed identifiers.
 */

type JsonObject = { readonly [key: string]: Json };
type MutableJsonObject = { [key: string]: Json };

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
export const WEBHOOK_ENDPOINT_ID = "wh_conformance_001";
export const WEBHOOK_DELIVERY_ID = "del_conformance_001";
export const DEPLOY_ID = "deploy_conformance_001";
export const DEPLOY_BLOB_SHA256 =
  "3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea";
export const PUSH_SEND_ID = "push_send_conformance_001";

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

/** `/api/v1/products` response. */
export const API_PRODUCTS_FIXTURE: Json = [
  {
    duration: "monthly",
    id: PRODUCT_ID,
    name: "Monthly",
    projectId: "proj_conformance_001",
    slug: PRODUCT_SLUG,
    type: "subscription",
  },
];

const personAttributes = (email: string | null, name: string | null): Json => ({
  distinctId: DISTINCT_ID,
  email,
  name,
  personId: PERSON_ID,
});

/** `/api/v1/persons` responses. */
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

/** `/api/v1/persons` list response. */
export const API_PERSONS_LIST_FIXTURE: Json = [API_PERSON_FIXTURE];

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

/** `/api/v1/projects/:organizationId` list response. */
export const PROJECTS_LIST_FIXTURE: Json = [PROJECT_FIXTURE];

/** `/api/v1/perks` list response. */
export const PERKS_LIST_FIXTURE: Json = [
  { id: PERK_ID, name: "All Access", projectId: PROJECT_ID, slug: "all-access" },
];

/** `/api/v1/paywall-locations` list response. */
export const PAYWALL_LOCATIONS_LIST_FIXTURE: Json = [
  {
    description: null,
    id: PAYWALL_LOCATION_ID,
    name: "Onboarding",
    projectId: PROJECT_ID,
    slug: "onboarding",
  },
];

/** `/api/v1/product-perks/by-product-id/:productId` list response. */
export const PRODUCT_PERKS_LIST_FIXTURE: Json = [
  { id: PRODUCT_PERK_ID, perkId: PERK_ID, productId: PRODUCT_ID },
];

/** `/api/v1/payment-provider-configurations` list response. */
export const PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE: Json = [
  {
    enabled: true,
    id: PAYMENT_PROVIDER_CONFIGURATION_ID,
    name: "App Store",
    projectId: PROJECT_ID,
    providerId: "apple-app-store",
  },
];

/** `/api/v1/payment-provider-products` list response. */
export const PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE: Json = [
  {
    configuration: { productId: "com.voidhash.monthly.ios" },
    id: "ppp_conformance_001",
    paymentProviderConfigurationId: PAYMENT_PROVIDER_CONFIGURATION_ID,
    productId: PRODUCT_ID,
    providerId: "apple-app-store",
  },
];

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

/** `/api/v1/notifications/send` success response. */
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
