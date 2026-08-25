import {
  API_PERSONS_LIST_FIXTURE,
  API_PERSON_FIXTURE,
  API_PRODUCTS_FIXTURE,
  API_SECRET_KEY,
  DEVELOPMENT_PURCHASE_REQUEST_FIXTURE,
  DEVELOPMENT_PURCHASE_RESPONSE_FIXTURE,
  DISTINCT_ID,
  FEATURE_FLAGS_FIXTURE,
  MISSING_PERSON_ID,
  NOT_AUTHENTICATED_ERROR_FIXTURE,
  PERSON_ENTITLEMENTS_FIXTURE,
  PERSON_ID,
  PERSON_NOT_FOUND_ERROR_FIXTURE,
  PUBLISHABLE_KEY,
  RESOLVED_PAYWALL_FIXTURE,
  SCHEMA_FIXTURE,
  SCHEMA_VERSION_FIXTURE,
  SDK_PERSON_FIXTURE,
  SDK_PERSON_NOT_FOUND_ERROR_FIXTURE,
  SYNC_TRANSACTION_REQUEST_FIXTURE,
  SYNC_TRANSACTION_RESPONSE_FIXTURE,
} from "../fixtures";
import { step, type ConformanceSuite, type HttpMethod, type Json } from "../types";

const apiAuth = { "x-secret-key": API_SECRET_KEY };

/**
 * Ordered wire-level expectations exercised by every server-side SDK
 * (`@voidhash/node` today). Auth is a secret key passed as `x-secret-key`.
 */
export const apiCoreSuite: ConformanceSuite = {
  name: "api/core",
  category: "api",
  description:
    "Core read/write flows for server-side SDKs: schema, products, person create/list/update, and auth-error mapping.",
  steps: [
    step(
      "get-schema",
      { method: "GET", path: "/api/v1/schema", headers: apiAuth },
      { status: 200, body: SCHEMA_FIXTURE },
    ),
    step(
      "list-products",
      { method: "GET", path: "/api/v1/products", headers: apiAuth },
      { status: 200, body: API_PRODUCTS_FIXTURE },
    ),
    step(
      "create-person",
      {
        method: "POST",
        path: "/api/v1/persons",
        headers: apiAuth,
        body: { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
      },
      { status: 201, body: API_PERSON_FIXTURE },
    ),
    // The distinct-id lookup is a filter on the list endpoint; query strings
    // are not matched, so this step differs from `list-persons` only in order.
    step(
      "list-persons-by-distinct-id",
      { method: "GET", path: "/api/v1/persons", headers: apiAuth },
      { status: 200, body: API_PERSONS_LIST_FIXTURE },
    ),
    step(
      "list-persons",
      { method: "GET", path: "/api/v1/persons", headers: apiAuth },
      { status: 200, body: API_PERSONS_LIST_FIXTURE },
    ),
    step(
      "get-person-by-id",
      { method: "GET", path: `/api/v1/persons/${PERSON_ID}`, headers: apiAuth },
      { status: 200, body: API_PERSON_FIXTURE },
    ),
    step(
      "update-person",
      {
        method: "PATCH",
        path: `/api/v1/persons/${PERSON_ID}`,
        headers: apiAuth,
        body: { traits: { notes_created: 3, plan: "pro" } },
      },
      { status: 200, body: API_PERSON_FIXTURE },
    ),
    step(
      "get-person-entitlements",
      {
        method: "GET",
        path: `/api/v1/persons/${PERSON_ID}/entitlements`,
        headers: apiAuth,
      },
      { status: 200, body: PERSON_ENTITLEMENTS_FIXTURE },
    ),
    step(
      "person-not-found",
      {
        method: "GET",
        path: `/api/v1/persons/${MISSING_PERSON_ID}`,
        headers: apiAuth,
      },
      { status: 404, body: PERSON_NOT_FOUND_ERROR_FIXTURE },
    ),
    step(
      "get-schema-version",
      { method: "GET", path: "/api/v1/schema/version", headers: apiAuth },
      { status: 200, body: SCHEMA_VERSION_FIXTURE },
    ),
    step(
      "unauthorized-get-user",
      { method: "GET", path: "/api/v1/users/current", headers: apiAuth },
      { status: 401, body: NOT_AUTHENTICATED_ERROR_FIXTURE },
    ),
  ],
};

const PUBLISHABLE_HEADERS = {
  "x-publishable-key": PUBLISHABLE_KEY,
  "x-distinct-id": DISTINCT_ID,
  "x-sdk": "react-native",
  "x-platform": "ios",
  "x-platform-flavor": "native",
  "x-environment": "development",
  "x-is-backgrounded": "false",
  "x-is-debug-build": "true",
  "x-observer-mode": "false",
};
const REQUIRE_CLIENT_HEADERS = ["x-client-bundle-id", "x-client-version", "x-nonce"];

interface MobileRequest {
  readonly method: HttpMethod;
  readonly path: `/${string}`;
  readonly headers: typeof PUBLISHABLE_HEADERS;
  readonly requireHeaders: typeof REQUIRE_CLIENT_HEADERS;
  readonly body?: Json;
}

const mobileRequest = (method: HttpMethod, path: `/${string}`, body?: Json): MobileRequest => {
  if (body === undefined) {
    return { method, path, headers: PUBLISHABLE_HEADERS, requireHeaders: REQUIRE_CLIENT_HEADERS };
  }
  return {
    method,
    path,
    headers: PUBLISHABLE_HEADERS,
    requireHeaders: REQUIRE_CLIENT_HEADERS,
    body,
  };
};

const mobileGet = (path: `/${string}`) => mobileRequest("GET", path);

const mobilePost = (path: `/${string}`, body: Json) => mobileRequest("POST", path, body);

/** A dev-purchase guard rejection must come back as a validation error. */
const SDK_VALIDATION_ERROR_FIXTURE: Json = {
  _tag: "Api/SdkValidationError",
  message: "Development purchases require development environment and a debug build",
};

/**
 * Ordered wire-level expectations exercised by every mobile SDK
 * (React Native today, native iOS/Android runners against the same contract).
 * Auth is a publishable key plus the common `x-*` client headers.
 */
export const mobileCoreSuite: ConformanceSuite = {
  name: "mobile/core",
  category: "mobile",
  description:
    "Core flows for mobile SDKs: schema fetch, identify, person fetch/traits, feature flags, paywall resolution, transaction sync, and error mapping.",
  steps: [
    step("get-schema", mobileGet("/api/v1/sdk/schema"), {
      status: 200,
      body: SCHEMA_FIXTURE,
    }),
    step(
      "identify",
      mobilePost(
        "/api/v1/sdk/identify",
        { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
      ),
      { status: 200, body: SDK_PERSON_FIXTURE },
    ),
    step("get-person", mobileGet("/api/v1/sdk/person"), {
      status: 200,
      body: SDK_PERSON_FIXTURE,
    }),
    step(
      "sync-person-attributes",
      mobilePost("/api/v1/sdk/person/traits", {
        clientEventId: "evt_conformance_001",
        email: "user@example.com",
        name: "Conformance User",
        setOnce: { source: "conformance" },
        traits: { plan: "pro" },
      }),
      { status: 200, body: SDK_PERSON_FIXTURE },
    ),
    step(
      "evaluate-feature-flags",
      mobilePost("/api/v1/sdk/evaluate-flags", {
        flagKeys: ["new_paywall", "legacy_flow"],
      }),
      { status: 200, body: FEATURE_FLAGS_FIXTURE },
    ),
    step(
      "resolve-paywall",
      mobilePost("/api/v1/sdk/resolve-paywall", { locationSlug: "onboarding" }),
      { status: 200, body: RESOLVED_PAYWALL_FIXTURE },
    ),
    step(
      "sync-transaction",
      mobilePost("/api/v1/sdk/sync-transaction", SYNC_TRANSACTION_REQUEST_FIXTURE),
      { status: 200, body: SYNC_TRANSACTION_RESPONSE_FIXTURE },
    ),
    step(
      "development-purchase",
      mobilePost("/api/v1/sdk/development/purchase", DEVELOPMENT_PURCHASE_REQUEST_FIXTURE),
      { status: 200, body: DEVELOPMENT_PURCHASE_RESPONSE_FIXTURE },
    ),
    step("development-purchase-rejected-in-production-mode", {
      ...mobileRequest(
        "POST",
        "/api/v1/sdk/development/purchase",
        DEVELOPMENT_PURCHASE_REQUEST_FIXTURE,
      ),
      headers: { ...PUBLISHABLE_HEADERS, "x-environment": "production" },
    }, { status: 400, body: SDK_VALIDATION_ERROR_FIXTURE }),
    step("get-person-not-found", mobileGet("/api/v1/sdk/person"), {
      status: 404,
      body: SDK_PERSON_NOT_FOUND_ERROR_FIXTURE,
    }),
  ],
};
