import {
  ACTION_FORBIDDEN_ERROR_FIXTURE,
  API_KEY_FIXTURE,
  API_KEY_ID,
  API_KEY_NOT_FOUND_ERROR_FIXTURE,
  API_KEY_WITH_RAW_KEY_FIXTURE,
  API_SECRET_KEY,
  CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  DEPLOY_BLOB_HASH_MISMATCH_ERROR_FIXTURE,
  DEPLOY_BLOB_SHA256,
  DEPLOY_ID,
  DISTINCT_ID,
  FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  INCOMPLETE_DEPLOY_ERROR_FIXTURE,
  INVALID_API_SECRET_KEY,
  NOT_AUTHENTICATED_ERROR_FIXTURE,
  ORGANIZATION_FIXTURE,
  ORGANIZATION_ID,
  PAYWALL_LOCATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE,
  PERKS_LIST_FIXTURE,
  PERSON_ID,
  PRODUCT_ID,
  PRODUCT_PERKS_LIST_FIXTURE,
  PROJECTS_LIST_FIXTURE,
  PROJECT_FIXTURE,
  PUSH_SEND_ID,
  PUSH_SEND_NOT_ENABLED_ERROR_FIXTURE,
  SEND_NOTIFICATION_RESPONSE_FIXTURE,
  SESSION_FIXTURE,
  UPLOAD_PAYWALL_DEPLOY_BLOB_RESPONSE_FIXTURE,
  WEBHOOK_DELIVERY_FIXTURE,
  WEBHOOK_DELIVERY_ID,
  WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE,
  WEBHOOK_ENDPOINT_DISABLED_FIXTURE,
  WEBHOOK_ENDPOINT_FIXTURE,
  WEBHOOK_ENDPOINT_ID,
  WEBHOOK_ENDPOINT_NOT_FOUND_ERROR_FIXTURE,
  WEBHOOK_VALIDATION_ERROR_FIXTURE,
} from "../fixtures";
import { step, type ConformanceSuite } from "../types";

const apiAuth = { "x-secret-key": API_SECRET_KEY };
const invalidApiAuth = { "x-secret-key": INVALID_API_SECRET_KEY };
/** A second key id used for not-found steps so paths stay unique per step. */
const MISSING_API_KEY_ID = "ak_conformance_missing";
const MISSING_WEBHOOK_ENDPOINT_ID = "wh_conformance_missing";

/**
 * Authentication surface for server-side SDKs: session introspection plus
 * negative auth mapping. Typed runners drive the invalid-key step with a
 * second client instance and assert the typed 401 surfaces.
 */
export const apiAuthSuite: ConformanceSuite = {
  name: "api/auth",
  category: "api",
  description:
    "Secret-key auth: session introspection, forbidden-action mapping, and invalid-key rejection.",
  steps: [
    step("session", { method: "GET", path: "/api/v1/auth/session", headers: apiAuth }, {
      status: 200,
      body: SESSION_FIXTURE,
    }),
    step(
      "forbidden-session",
      { method: "GET", path: "/api/v1/auth/session", headers: apiAuth },
      { status: 403, body: ACTION_FORBIDDEN_ERROR_FIXTURE },
    ),
    step(
      "invalid-key-get-user",
      { method: "GET", path: "/api/v1/users/current", headers: invalidApiAuth },
      { status: 401, body: NOT_AUTHENTICATED_ERROR_FIXTURE },
    ),
    step("forbidden-list-products", { method: "GET", path: "/api/v1/products", headers: apiAuth }, {
      status: 403,
      body: ACTION_FORBIDDEN_ERROR_FIXTURE,
    }),
  ],
};

/** Organization & project management flows. */
export const apiProjectsOrgsSuite: ConformanceSuite = {
  name: "api/projects-orgs",
  category: "api",
  description: "Organization creation and project creation/listing.",
  steps: [
    step(
      "create-organization",
      {
        method: "POST",
        path: "/api/v1/organizations",
        headers: apiAuth,
        body: { name: "Conformance Org" },
      },
      { status: 200, body: ORGANIZATION_FIXTURE },
    ),
    step(
      "create-project",
      {
        method: "POST",
        path: "/api/v1/projects",
        headers: apiAuth,
        body: { name: "Conformance Project", organizationId: ORGANIZATION_ID },
      },
      { status: 200, body: PROJECT_FIXTURE },
    ),
    step(
      "list-projects",
      {
        method: "GET",
        path: `/api/v1/projects/${ORGANIZATION_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PROJECTS_LIST_FIXTURE },
    ),
  ],
};

/** Secret key lifecycle including the raw-key-once disclosure semantics. */
export const apiApiKeysSuite: ConformanceSuite = {
  name: "api/api-keys",
  category: "api",
  description: "API key create/list/get/rotate/delete plus not-found error mapping.",
  steps: [
    step(
      "create-secret-key",
      {
        method: "POST",
        path: "/api/v1/api-keys",
        headers: apiAuth,
        body: { name: "Conformance Secret Key", projectId: "proj_conformance_001" },
      },
      { status: 200, body: API_KEY_WITH_RAW_KEY_FIXTURE },
    ),
    step("list-api-keys", { method: "GET", path: "/api/v1/api-keys", headers: apiAuth }, {
      status: 200,
      body: [API_KEY_FIXTURE],
    }),
    step(
      "get-api-key",
      { method: "GET", path: `/api/v1/api-keys/${API_KEY_ID}`, headers: apiAuth },
      { status: 200, body: API_KEY_FIXTURE },
    ),
    step(
      "rotate-secret-key",
      {
        method: "POST",
        path: `/api/v1/api-keys/${API_KEY_ID}/rotate`,
        headers: apiAuth,
      },
      { status: 200, body: API_KEY_WITH_RAW_KEY_FIXTURE },
    ),
    step(
      "delete-api-key",
      { method: "DELETE", path: `/api/v1/api-keys/${API_KEY_ID}`, headers: apiAuth },
      { status: 204 },
    ),
    step(
      "get-missing-api-key",
      {
        method: "GET",
        path: `/api/v1/api-keys/${MISSING_API_KEY_ID}`,
        headers: apiAuth,
      },
      { status: 404, body: API_KEY_NOT_FOUND_ERROR_FIXTURE },
    ),
  ],
};

/** Full webhook endpoint + delivery lifecycle. */
export const apiWebhooksSuite: ConformanceSuite = {
  name: "api/webhooks",
  category: "api",
  description:
    "Webhook endpoints (create/list/get/update/rotate/test) and deliveries (list/get/retry), plus validation and not-found error mapping.",
  steps: [
    step(
      "create-endpoint",
      {
        method: "POST",
        path: "/api/v1/webhooks/endpoints",
        headers: apiAuth,
        body: {
          events: ["purchase.completed", "subscription.created"],
          name: "Conformance Endpoint",
          url: "https://hooks.conformance.voidhash.test/receive",
        },
      },
      { status: 200, body: WEBHOOK_ENDPOINT_FIXTURE },
    ),
    step(
      "list-endpoints",
      { method: "GET", path: "/api/v1/webhooks/endpoints", headers: apiAuth },
      { status: 200, body: [WEBHOOK_ENDPOINT_FIXTURE] },
    ),
    step(
      "get-endpoint",
      {
        method: "GET",
        path: `/api/v1/webhooks/endpoints/${WEBHOOK_ENDPOINT_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: WEBHOOK_ENDPOINT_FIXTURE },
    ),
    step(
      "update-endpoint",
      {
        method: "PATCH",
        path: `/api/v1/webhooks/endpoints/${WEBHOOK_ENDPOINT_ID}`,
        headers: apiAuth,
        body: { description: "Rotated", events: ["purchase.completed"], status: "disabled" },
      },
      { status: 200, body: WEBHOOK_ENDPOINT_DISABLED_FIXTURE },
    ),
    step(
      "rotate-endpoint-secret",
      {
        method: "POST",
        path: `/api/v1/webhooks/endpoints/${WEBHOOK_ENDPOINT_ID}/rotate-secret`,
        headers: apiAuth,
      },
      { status: 200, body: WEBHOOK_ENDPOINT_DISABLED_FIXTURE },
    ),
    step(
      "test-endpoint",
      {
        method: "POST",
        path: `/api/v1/webhooks/endpoints/${WEBHOOK_ENDPOINT_ID}/test`,
        headers: apiAuth,
      },
      { status: 200, body: WEBHOOK_DELIVERY_FIXTURE },
    ),
    step(
      "delete-endpoint",
      {
        method: "DELETE",
        path: `/api/v1/webhooks/endpoints/${WEBHOOK_ENDPOINT_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "create-endpoint-validation-error",
      {
        method: "POST",
        path: "/api/v1/webhooks/endpoints",
        headers: apiAuth,
        body: {
          events: ["purchase.completed"],
          name: "Bad Endpoint",
          url: "not-a-url",
        },
      },
      { status: 400, body: WEBHOOK_VALIDATION_ERROR_FIXTURE },
    ),
    step(
      "get-missing-endpoint",
      {
        method: "GET",
        path: `/api/v1/webhooks/endpoints/${MISSING_WEBHOOK_ENDPOINT_ID}`,
        headers: apiAuth,
      },
      { status: 404, body: WEBHOOK_ENDPOINT_NOT_FOUND_ERROR_FIXTURE },
    ),
    step(
      "list-deliveries",
      { method: "GET", path: "/api/v1/webhooks/deliveries", headers: apiAuth },
      { status: 200, body: [WEBHOOK_DELIVERY_FIXTURE] },
    ),
    step(
      "get-delivery",
      {
        method: "GET",
        path: `/api/v1/webhooks/deliveries/${WEBHOOK_DELIVERY_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE },
    ),
    step(
      "retry-delivery",
      {
        method: "POST",
        path: `/api/v1/webhooks/deliveries/${WEBHOOK_DELIVERY_ID}/retry`,
        headers: apiAuth,
      },
      { status: 200, body: WEBHOOK_DELIVERY_FIXTURE },
    ),
  ],
};

/** Read-only catalog endpoints shared by every server-side integration. */
export const apiCatalogSuite: ConformanceSuite = {
  name: "api/catalog",
  category: "api",
  description:
    "Read-only catalog listing: perks, paywall locations, product perks, payment provider configurations and products.",
  steps: [
    step("list-perks", { method: "GET", path: "/api/v1/perks", headers: apiAuth }, {
      status: 200,
      body: PERKS_LIST_FIXTURE,
    }),
    step(
      "list-paywall-locations",
      { method: "GET", path: "/api/v1/paywall-locations", headers: apiAuth },
      { status: 200, body: PAYWALL_LOCATIONS_LIST_FIXTURE },
    ),
    step(
      "list-product-perks",
      {
        method: "GET",
        path: `/api/v1/product-perks/by-product-id/${PRODUCT_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PRODUCT_PERKS_LIST_FIXTURE },
    ),
    step(
      "list-payment-provider-configurations",
      {
        method: "GET",
        path: "/api/v1/payment-provider-configurations",
        headers: apiAuth,
      },
      { status: 200, body: PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE },
    ),
    step(
      "list-payment-provider-products",
      {
        method: "GET",
        path: "/api/v1/payment-provider-products",
        headers: apiAuth,
      },
      { status: 200, body: PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE },
    ),
  ],
};

/** Server-to-server push dispatch. */
export const apiNotificationsSuite: ConformanceSuite = {
  name: "api/notifications",
  category: "api",
  description: "Push notification send plus the not-enabled conflict error.",
  steps: [
    step(
      "send-notification",
      {
        method: "POST",
        path: "/api/v1/notifications/send",
        headers: apiAuth,
        body: {
          badge: 1,
          body: "Conformance push",
          collapseId: `collapse-${PUSH_SEND_ID}`,
          data: { source: "conformance" },
          distinctIds: [DISTINCT_ID],
          personIds: [PERSON_ID],
          priority: "high",
          sound: "default",
          title: "Conformance",
          ttl: 3600,
        },
      },
      { status: 200, body: SEND_NOTIFICATION_RESPONSE_FIXTURE },
    ),
    step(
      "send-notification-not-enabled",
      {
        method: "POST",
        path: "/api/v1/notifications/send",
        headers: apiAuth,
        body: {
          body: "Conformance push",
          distinctIds: [`missing-${DISTINCT_ID}`],
          title: "Conformance",
        },
      },
      { status: 409, body: PUSH_SEND_NOT_ENABLED_ERROR_FIXTURE },
    ),
  ],
};

/**
 * Paywall deploy flow: create (201), blob upload (binary PUT), finalize, and
 * the two failure mappings integrations rely on.
 */
export const apiPaywallDeploysSuite: ConformanceSuite = {
  name: "api/paywall-deploys",
  category: "api",
  description:
    "Paywall deploy lifecycle: manifest create (201), binary blob upload, finalize, plus hash-mismatch and incomplete-deploy errors.",
  steps: [
    step(
      "create-deploy",
      {
        method: "POST",
        path: "/api/v1/paywall-deploys",
        headers: apiAuth,
        body: {
          components: [{ contentHash: DEPLOY_BLOB_SHA256, id: "hero" }],
          paywalls: [
            {
              contentHash: DEPLOY_BLOB_SHA256,
              id: "onboarding",
              name: "Onboarding Paywall",
              slug: "onboarding",
            },
          ],
          schemaVersion: 1,
        },
      },
      { status: 201, body: CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE },
    ),
    step(
      "upload-blob",
      {
        method: "PUT",
        path: `/api/v1/paywall-deploys/${DEPLOY_ID}/blobs/${DEPLOY_BLOB_SHA256}`,
        // Binary octet-stream payload: body matching is skipped by design.
        headers: apiAuth,
      },
      { status: 200, body: UPLOAD_PAYWALL_DEPLOY_BLOB_RESPONSE_FIXTURE },
    ),
    step(
      "blob-hash-mismatch",
      {
        method: "PUT",
        path: `/api/v1/paywall-deploys/${DEPLOY_ID}/blobs/${DEPLOY_BLOB_SHA256}`,
        headers: apiAuth,
      },
      { status: 422, body: DEPLOY_BLOB_HASH_MISMATCH_ERROR_FIXTURE },
    ),
    step(
      "finalize-deploy",
      {
        method: "POST",
        path: `/api/v1/paywall-deploys/${DEPLOY_ID}/finalize`,
        headers: apiAuth,
      },
      { status: 200, body: FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE },
    ),
    step(
      "finalize-incomplete",
      {
        method: "POST",
        path: `/api/v1/paywall-deploys/${DEPLOY_ID}/finalize`,
        headers: apiAuth,
      },
      { status: 409, body: INCOMPLETE_DEPLOY_ERROR_FIXTURE },
    ),
  ],
};
