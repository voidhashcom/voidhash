import type { Json } from "./types";

/**
 * Deterministic fixture data shared by every conformance suite. All values are
 * stable across languages: no floats beyond JSON-safe precision, string
 * timestamps, and fixed identifiers.
 */

export const API_SECRET_KEY = "sk_test_conformance_7f3a91b2";
export const PUBLISHABLE_KEY = "pk_test_conformance_c41d88";

export const DISTINCT_ID = "user_conformance_001";
export const PERSON_ID = "person_conformance_001";
export const PRODUCT_ID = "prod_monthly";
export const PRODUCT_SLUG = "monthly_sub";

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
