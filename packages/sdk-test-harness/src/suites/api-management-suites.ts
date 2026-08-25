import {
  ACTIVATED_PAYWALL_RELEASE_FIXTURE,
  API_SECRET_KEY,
  BLOCKED_CUSTOM_EVENT_NAME,
  DEPLOY_ID,
  DEVELOPMENT_LIFECYCLE_ACTION_ACCEPTED_FIXTURE,
  DEVELOPMENT_LIFECYCLE_ACTION_ID,
  DEVELOPMENT_SETTINGS_DISABLED_FIXTURE,
  DEVELOPMENT_SETTINGS_FIXTURE,
  DEVELOPMENT_STATE_FIXTURE,
  DEVELOPMENT_SUBSCRIPTION_ID,
  DISTINCT_ID,
  EVALUATED_FEATURE_FLAGS_FIXTURE,
  EVENTS_LIST_FIXTURE,
  EXPERIMENT_CONCLUDED_FIXTURE,
  EXPERIMENT_CONFIGURED_FIXTURE,
  EXPERIMENT_CONTROL_VARIANT_ID,
  EXPERIMENT_DRAFT_FIXTURE,
  EXPERIMENT_ID,
  EXPERIMENT_PAUSED_FIXTURE,
  EXPERIMENT_RESULTS_FIXTURE,
  EXPERIMENT_RUNNING_FIXTURE,
  EXPERIMENT_TREATMENT_VARIANT_ID,
  EXPERIMENTS_LIST_FIXTURE,
  FEATURE_FLAG_ENABLED_FIXTURE,
  FEATURE_FLAG_FIXTURE,
  FEATURE_FLAG_ID,
  FEATURE_FLAG_OVERRIDE_FIXTURE,
  FEATURE_FLAG_OVERRIDE_ID,
  FEATURE_FLAG_OVERRIDES_LIST_FIXTURE,
  FEATURE_FLAG_SLUG,
  FEATURE_FLAG_TARGET_FIXTURE,
  FEATURE_FLAG_TARGET_ID,
  FEATURE_FLAG_TARGETS_LIST_FIXTURE,
  FEATURE_FLAG_WITH_VARIANTS_FIXTURE,
  FEATURE_FLAGS_LIST_FIXTURE,
  INGEST_BUILTIN_EVENT_KEY,
  INGEST_POLICY_BUILTIN_DISABLED_FIXTURE,
  INGEST_POLICY_CUSTOM_BLOCKED_FIXTURE,
  INGEST_POLICY_FIXTURE,
  NOTIFICATION_DELIVERIES_LIST_FIXTURE,
  NOTIFICATION_SENDS_LIST_FIXTURE,
  ORGANIZATION_FIXTURE,
  ORGANIZATION_ID,
  ORGANIZATION_RENAMED_FIXTURE,
  ORGANIZATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_ENABLED_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_ID,
  PAYMENT_PROVIDER_PRODUCT_ACTIVE_FIXTURE,
  PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE,
  PAYMENT_PROVIDER_PRODUCT_ID,
  PAYMENT_PROVIDER_PRODUCT_UPDATED_FIXTURE,
  PAYWALL_DEPLOY_FIXTURE,
  PAYWALL_DEPLOYS_LIST_FIXTURE,
  PAYWALL_FIXTURE,
  PAYWALL_ID,
  PAYWALL_LOCATION_FIXTURE,
  PAYWALL_LOCATION_ID,
  PAYWALL_LOCATION_RENAMED_FIXTURE,
  PAYWALL_LOCATION_SHOWING_FIXTURE,
  PAYWALL_LOCATION_SHOWINGS_LIST_FIXTURE,
  PAYWALL_RELEASE_DRAFT_FIXTURE,
  PAYWALL_RELEASE_ID,
  PAYWALL_RELEASE_PUBLISHED_FIXTURE,
  PAYWALL_RELEASES_LIST_FIXTURE,
  PAYWALL_RENAMED_FIXTURE,
  PAYWALL_SLUG,
  PAYWALLS_LIST_FIXTURE,
  PERK_FIXTURE,
  PERK_ID,
  PERK_RENAMED_FIXTURE,
  PRODUCT_DETAIL_FIXTURE,
  PRODUCT_ID,
  PRODUCT_PERK_FIXTURE,
  PRODUCT_RENAMED_FIXTURE,
  PRODUCT_SLUG,
  PROJECT_FIXTURE,
  PROJECT_ID,
  PROJECT_RENAMED_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_ID,
  PUSH_NOTIFICATION_CONFIGURATIONS_LIST_FIXTURE,
  PUSH_SEND_ID,
  QUERY_INSIGHTS_RESULT_FIXTURE,
} from "../fixtures";
import { step, type ConformanceSuite } from "../types";

const apiAuth = { "x-secret-key": API_SECRET_KEY };

/**
 * The development group refuses production-scoped requests, so every step is
 * driven with `x-environment: development` alongside the secret key. Typed
 * runners set the header once on the client instance.
 */
const developmentAuth = { ...apiAuth, "x-environment": "development" };

/** Organization reads/renames plus the project read/update/delete lifecycle. */
export const apiOrganizationsSuite: ConformanceSuite = {
  name: "api/organizations",
  category: "api",
  description:
    "Organization list/get/rename and project get/rename/delete for management credentials.",
  steps: [
    step(
      "list-organizations",
      { method: "GET", path: "/api/v1/organizations", headers: apiAuth },
      { status: 200, body: ORGANIZATIONS_LIST_FIXTURE },
    ),
    step(
      "get-organization",
      { method: "GET", path: `/api/v1/organizations/${ORGANIZATION_ID}`, headers: apiAuth },
      { status: 200, body: ORGANIZATION_FIXTURE },
    ),
    step(
      "update-organization",
      {
        method: "PATCH",
        path: `/api/v1/organizations/${ORGANIZATION_ID}`,
        headers: apiAuth,
        body: { name: "Conformance Org Renamed" },
      },
      { status: 200, body: ORGANIZATION_RENAMED_FIXTURE },
    ),
    step(
      "get-project",
      { method: "GET", path: `/api/v1/projects/${PROJECT_ID}`, headers: apiAuth },
      { status: 200, body: PROJECT_FIXTURE },
    ),
    step(
      "update-project",
      {
        method: "PATCH",
        path: `/api/v1/projects/${PROJECT_ID}`,
        headers: apiAuth,
        body: { name: "Conformance Project Renamed" },
      },
      { status: 200, body: PROJECT_RENAMED_FIXTURE },
    ),
    step(
      "delete-project",
      { method: "DELETE", path: `/api/v1/projects/${PROJECT_ID}`, headers: apiAuth },
      { status: 204 },
    ),
  ],
};

/** Perk and product CRUD plus the product↔perk attachment lifecycle. */
export const apiProductsSuite: ConformanceSuite = {
  name: "api/products",
  category: "api",
  description:
    "Catalog writes: perk create/get/update, product create/get/update, perk attach/detach, and both deletes.",
  steps: [
    step(
      "create-perk",
      {
        method: "POST",
        path: "/api/v1/perks",
        headers: apiAuth,
        body: { name: "All Access", slug: "all-access" },
      },
      { status: 201, body: PERK_FIXTURE },
    ),
    step(
      "get-perk",
      { method: "GET", path: `/api/v1/perks/${PERK_ID}`, headers: apiAuth },
      { status: 200, body: PERK_FIXTURE },
    ),
    step(
      "update-perk",
      {
        method: "PATCH",
        path: `/api/v1/perks/${PERK_ID}`,
        headers: apiAuth,
        body: { name: "All Access Plus" },
      },
      { status: 200, body: PERK_RENAMED_FIXTURE },
    ),
    step(
      "create-product",
      {
        method: "POST",
        path: "/api/v1/products",
        headers: apiAuth,
        body: { duration: 30, name: "Monthly", slug: PRODUCT_SLUG, type: "subscription" },
      },
      { status: 201, body: PRODUCT_DETAIL_FIXTURE },
    ),
    step(
      "get-product",
      { method: "GET", path: `/api/v1/products/${PRODUCT_ID}`, headers: apiAuth },
      { status: 200, body: PRODUCT_DETAIL_FIXTURE },
    ),
    step(
      "update-product",
      {
        method: "PATCH",
        path: `/api/v1/products/${PRODUCT_ID}`,
        headers: apiAuth,
        body: { name: "Monthly Plus" },
      },
      { status: 200, body: PRODUCT_RENAMED_FIXTURE },
    ),
    step(
      "attach-product-perk",
      {
        method: "POST",
        path: `/api/v1/products/${PRODUCT_ID}/perks`,
        headers: apiAuth,
        body: { perkId: PERK_ID },
      },
      { status: 201, body: PRODUCT_PERK_FIXTURE },
    ),
    step(
      "detach-product-perk",
      {
        method: "DELETE",
        path: `/api/v1/products/${PRODUCT_ID}/perks/${PERK_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "delete-product",
      { method: "DELETE", path: `/api/v1/products/${PRODUCT_ID}`, headers: apiAuth },
      { status: 204 },
    ),
    step(
      "delete-perk",
      { method: "DELETE", path: `/api/v1/perks/${PERK_ID}`, headers: apiAuth },
      { status: 204 },
    ),
  ],
};

/** Payment provider configuration + product mapping write lifecycle. */
export const apiPaymentProvidersSuite: ConformanceSuite = {
  name: "api/payment-providers",
  category: "api",
  description:
    "Payment provider configuration create/get/update, product-mapping create/get/update/activate, and both deletes.",
  steps: [
    step(
      "create-configuration",
      {
        method: "POST",
        path: "/api/v1/payment-provider-configurations",
        headers: apiAuth,
        body: { providerId: "stripe" },
      },
      { status: 201, body: PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE },
    ),
    step(
      "get-configuration",
      {
        method: "GET",
        path: `/api/v1/payment-provider-configurations/${PAYMENT_PROVIDER_CONFIGURATION_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE },
    ),
    step(
      "update-configuration",
      {
        method: "PATCH",
        path: `/api/v1/payment-provider-configurations/${PAYMENT_PROVIDER_CONFIGURATION_ID}`,
        headers: apiAuth,
        body: {
          configuration: { secretKey: "sk_live_conformance_001" },
          enabled: true,
          name: "Stripe Production",
        },
      },
      { status: 200, body: PAYMENT_PROVIDER_CONFIGURATION_ENABLED_FIXTURE },
    ),
    step(
      "create-product-mapping",
      {
        method: "POST",
        path: "/api/v1/payment-provider-products",
        headers: apiAuth,
        body: {
          configuration: { productId: "price_conformance_001" },
          paymentProviderConfigurationId: PAYMENT_PROVIDER_CONFIGURATION_ID,
          productId: PRODUCT_ID,
        },
      },
      { status: 201, body: PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE },
    ),
    step(
      "get-product-mapping",
      {
        method: "GET",
        path: `/api/v1/payment-provider-products/${PAYMENT_PROVIDER_PRODUCT_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE },
    ),
    step(
      "update-product-mapping",
      {
        method: "PATCH",
        path: `/api/v1/payment-provider-products/${PAYMENT_PROVIDER_PRODUCT_ID}`,
        headers: apiAuth,
        body: { configuration: { productId: "price_conformance_002" } },
      },
      { status: 200, body: PAYMENT_PROVIDER_PRODUCT_UPDATED_FIXTURE },
    ),
    step(
      "activate-product-mapping",
      {
        method: "POST",
        path: `/api/v1/payment-provider-products/${PAYMENT_PROVIDER_PRODUCT_ID}/activate`,
        headers: apiAuth,
      },
      { status: 200, body: PAYMENT_PROVIDER_PRODUCT_ACTIVE_FIXTURE },
    ),
    step(
      "delete-product-mapping",
      {
        method: "DELETE",
        path: `/api/v1/payment-provider-products/${PAYMENT_PROVIDER_PRODUCT_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "delete-configuration",
      {
        method: "DELETE",
        path: `/api/v1/payment-provider-configurations/${PAYMENT_PROVIDER_CONFIGURATION_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
  ],
};

/** Paywall CRUD plus the release draft → publish → activate pipeline. */
export const apiPaywallsSuite: ConformanceSuite = {
  name: "api/paywalls",
  category: "api",
  description:
    "Paywall create/get/update/list, release create/list/publish/activate, and archive/restore.",
  steps: [
    step(
      "create-paywall",
      {
        method: "POST",
        path: "/api/v1/paywalls",
        headers: apiAuth,
        body: { name: "Conformance Paywall", slug: PAYWALL_SLUG },
      },
      { status: 201, body: PAYWALL_FIXTURE },
    ),
    step(
      "get-paywall",
      { method: "GET", path: `/api/v1/paywalls/${PAYWALL_ID}`, headers: apiAuth },
      { status: 200, body: PAYWALL_FIXTURE },
    ),
    step(
      "update-paywall",
      {
        method: "PATCH",
        path: `/api/v1/paywalls/${PAYWALL_ID}`,
        headers: apiAuth,
        body: { name: "Conformance Paywall v2" },
      },
      { status: 200, body: PAYWALL_RENAMED_FIXTURE },
    ),
    step("list-paywalls", { method: "GET", path: "/api/v1/paywalls", headers: apiAuth }, {
      status: 200,
      body: PAYWALLS_LIST_FIXTURE,
    }),
    step(
      "create-release",
      {
        method: "POST",
        path: `/api/v1/paywalls/${PAYWALL_ID}/releases`,
        headers: apiAuth,
      },
      { status: 201, body: PAYWALL_RELEASE_DRAFT_FIXTURE },
    ),
    step(
      "list-releases",
      { method: "GET", path: `/api/v1/paywalls/${PAYWALL_ID}/releases`, headers: apiAuth },
      { status: 200, body: PAYWALL_RELEASES_LIST_FIXTURE },
    ),
    step(
      "publish-release",
      {
        method: "POST",
        path: `/api/v1/paywalls/${PAYWALL_ID}/releases/${PAYWALL_RELEASE_ID}/publish`,
        headers: apiAuth,
      },
      { status: 200, body: PAYWALL_RELEASE_PUBLISHED_FIXTURE },
    ),
    step(
      "activate-release",
      {
        method: "POST",
        path: `/api/v1/paywalls/${PAYWALL_ID}/releases/${PAYWALL_RELEASE_ID}/activate`,
        headers: apiAuth,
      },
      { status: 200, body: ACTIVATED_PAYWALL_RELEASE_FIXTURE },
    ),
    step(
      "archive-paywall",
      { method: "DELETE", path: `/api/v1/paywalls/${PAYWALL_ID}`, headers: apiAuth },
      { status: 204 },
    ),
    step(
      "restore-paywall",
      { method: "POST", path: `/api/v1/paywalls/${PAYWALL_ID}/restore`, headers: apiAuth },
      { status: 200, body: PAYWALL_RENAMED_FIXTURE },
    ),
  ],
};

/** Paywall location writes and the showing assignment lifecycle. */
export const apiPaywallLocationsSuite: ConformanceSuite = {
  name: "api/paywall-locations",
  category: "api",
  description:
    "Location create/get/update, showing set/list/clear, and location archive.",
  steps: [
    step(
      "create-location",
      {
        method: "POST",
        path: "/api/v1/paywall-locations",
        headers: apiAuth,
        body: { name: "Onboarding", slug: "onboarding" },
      },
      { status: 201, body: PAYWALL_LOCATION_FIXTURE },
    ),
    step(
      "get-location",
      {
        method: "GET",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PAYWALL_LOCATION_FIXTURE },
    ),
    step(
      "update-location",
      {
        method: "PATCH",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}`,
        headers: apiAuth,
        body: { description: "Shown after signup", name: "Onboarding Updated" },
      },
      { status: 200, body: PAYWALL_LOCATION_RENAMED_FIXTURE },
    ),
    step(
      "set-showing",
      {
        method: "PUT",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}/showing`,
        headers: apiAuth,
        body: { paywallId: PAYWALL_ID, type: "paywall_release" },
      },
      { status: 200, body: PAYWALL_LOCATION_SHOWING_FIXTURE },
    ),
    step(
      "list-showings",
      {
        method: "GET",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}/showings`,
        headers: apiAuth,
      },
      { status: 200, body: PAYWALL_LOCATION_SHOWINGS_LIST_FIXTURE },
    ),
    step(
      "clear-showing",
      {
        method: "DELETE",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}/showing`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "archive-location",
      {
        method: "DELETE",
        path: `/api/v1/paywall-locations/${PAYWALL_LOCATION_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
  ],
};

/** Read side of the deploy pipeline: history listing and a single deploy. */
export const apiPaywallDeployReadsSuite: ConformanceSuite = {
  name: "api/paywall-deploy-reads",
  category: "api",
  description: "Paywall deploy history: list deploys and get one deploy by id.",
  steps: [
    step(
      "list-deploys",
      { method: "GET", path: "/api/v1/paywall-deploys", headers: apiAuth },
      { status: 200, body: PAYWALL_DEPLOYS_LIST_FIXTURE },
    ),
    step(
      "get-deploy",
      { method: "GET", path: `/api/v1/paywall-deploys/${DEPLOY_ID}`, headers: apiAuth },
      { status: 200, body: PAYWALL_DEPLOY_FIXTURE },
    ),
  ],
};

/** Feature flag CRUD, variants, server-side evaluation, overrides and targets. */
export const apiFeatureFlagsSuite: ConformanceSuite = {
  name: "api/feature-flags",
  category: "api",
  description:
    "Flag create/get/update/variants/list/evaluate, override and target upsert/list/archive, and flag archive/restore.",
  steps: [
    step(
      "create-feature-flag",
      {
        method: "POST",
        path: "/api/v1/feature-flags",
        headers: apiAuth,
        body: { slug: FEATURE_FLAG_SLUG },
      },
      { status: 201, body: FEATURE_FLAG_FIXTURE },
    ),
    step(
      "get-feature-flag",
      { method: "GET", path: `/api/v1/feature-flags/${FEATURE_FLAG_ID}`, headers: apiAuth },
      { status: 200, body: FEATURE_FLAG_FIXTURE },
    ),
    step(
      "update-feature-flag",
      {
        method: "PATCH",
        path: `/api/v1/feature-flags/${FEATURE_FLAG_ID}`,
        headers: apiAuth,
        body: { enabled: true, rolloutBps: 5000 },
      },
      { status: 200, body: FEATURE_FLAG_ENABLED_FIXTURE },
    ),
    step(
      "replace-variants",
      {
        method: "PUT",
        path: `/api/v1/feature-flags/${FEATURE_FLAG_ID}/variants`,
        headers: apiAuth,
        body: { variants: [{ label: "Treatment", value: true, weightBps: 10000 }] },
      },
      { status: 200, body: FEATURE_FLAG_WITH_VARIANTS_FIXTURE },
    ),
    step(
      "list-feature-flags",
      { method: "GET", path: "/api/v1/feature-flags", headers: apiAuth },
      { status: 200, body: FEATURE_FLAGS_LIST_FIXTURE },
    ),
    step(
      "evaluate-feature-flags",
      {
        method: "POST",
        path: "/api/v1/feature-flags/evaluate",
        headers: apiAuth,
        body: { distinctId: DISTINCT_ID, keys: [FEATURE_FLAG_SLUG] },
      },
      { status: 200, body: EVALUATED_FEATURE_FLAGS_FIXTURE },
    ),
    step(
      "upsert-override",
      {
        method: "POST",
        path: "/api/v1/feature-flag-overrides",
        headers: apiAuth,
        body: {
          featureFlagId: FEATURE_FLAG_ID,
          forcedEnabled: true,
          identityType: 2,
          identityValue: DISTINCT_ID,
        },
      },
      { status: 201, body: FEATURE_FLAG_OVERRIDE_FIXTURE },
    ),
    step(
      "list-overrides",
      { method: "GET", path: "/api/v1/feature-flag-overrides", headers: apiAuth },
      { status: 200, body: FEATURE_FLAG_OVERRIDES_LIST_FIXTURE },
    ),
    step(
      "archive-override",
      {
        method: "DELETE",
        path: `/api/v1/feature-flag-overrides/${FEATURE_FLAG_OVERRIDE_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "upsert-target",
      {
        method: "POST",
        path: "/api/v1/feature-flag-targets",
        headers: apiAuth,
        body: {
          featureFlagId: FEATURE_FLAG_ID,
          identityType: 2,
          identityValue: DISTINCT_ID,
          listType: 1,
        },
      },
      { status: 201, body: FEATURE_FLAG_TARGET_FIXTURE },
    ),
    step(
      "list-targets",
      { method: "GET", path: "/api/v1/feature-flag-targets", headers: apiAuth },
      { status: 200, body: FEATURE_FLAG_TARGETS_LIST_FIXTURE },
    ),
    step(
      "archive-target",
      {
        method: "DELETE",
        path: `/api/v1/feature-flag-targets/${FEATURE_FLAG_TARGET_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
    step(
      "archive-feature-flag",
      { method: "DELETE", path: `/api/v1/feature-flags/${FEATURE_FLAG_ID}`, headers: apiAuth },
      { status: 204 },
    ),
    step(
      "restore-feature-flag",
      {
        method: "POST",
        path: `/api/v1/feature-flags/${FEATURE_FLAG_ID}/restore`,
        headers: apiAuth,
      },
      { status: 200, body: FEATURE_FLAG_WITH_VARIANTS_FIXTURE },
    ),
  ],
};

/** Full experiment lifecycle: author, run, conclude, read out, archive. */
export const apiExperimentsSuite: ConformanceSuite = {
  name: "api/experiments",
  category: "api",
  description:
    "Experiment create/get/update, start/pause/conclude, results, list, and archive/restore.",
  steps: [
    step(
      "create-experiment",
      {
        method: "POST",
        path: "/api/v1/experiments",
        headers: apiAuth,
        body: { name: "Conformance Experiment" },
      },
      { status: 201, body: EXPERIMENT_DRAFT_FIXTURE },
    ),
    step(
      "get-experiment",
      { method: "GET", path: `/api/v1/experiments/${EXPERIMENT_ID}`, headers: apiAuth },
      { status: 200, body: EXPERIMENT_DRAFT_FIXTURE },
    ),
    step(
      "update-experiment",
      {
        method: "PATCH",
        path: `/api/v1/experiments/${EXPERIMENT_ID}`,
        headers: apiAuth,
        body: {
          description: "Conformance experiment",
          hypothesis: "Treatment converts better",
          primaryMetricEventName: "$purchase",
          variants: [
            {
              id: EXPERIMENT_CONTROL_VARIANT_ID,
              isControl: true,
              name: "Control",
              treatments: [],
              weightBps: 5000,
            },
            {
              id: EXPERIMENT_TREATMENT_VARIANT_ID,
              isControl: false,
              name: "Treatment",
              treatments: [
                { paywallId: PAYWALL_ID, paywallLocationId: PAYWALL_LOCATION_ID },
              ],
              weightBps: 5000,
            },
          ],
        },
      },
      { status: 200, body: EXPERIMENT_CONFIGURED_FIXTURE },
    ),
    step(
      "start-experiment",
      { method: "POST", path: `/api/v1/experiments/${EXPERIMENT_ID}/start`, headers: apiAuth },
      { status: 200, body: EXPERIMENT_RUNNING_FIXTURE },
    ),
    step(
      "pause-experiment",
      { method: "POST", path: `/api/v1/experiments/${EXPERIMENT_ID}/pause`, headers: apiAuth },
      { status: 200, body: EXPERIMENT_PAUSED_FIXTURE },
    ),
    step(
      "conclude-experiment",
      {
        method: "POST",
        path: `/api/v1/experiments/${EXPERIMENT_ID}/conclude`,
        headers: apiAuth,
        body: { winningVariantId: EXPERIMENT_TREATMENT_VARIANT_ID },
      },
      { status: 200, body: EXPERIMENT_CONCLUDED_FIXTURE },
    ),
    step(
      "get-experiment-results",
      { method: "GET", path: `/api/v1/experiments/${EXPERIMENT_ID}/results`, headers: apiAuth },
      { status: 200, body: EXPERIMENT_RESULTS_FIXTURE },
    ),
    step(
      "list-experiments",
      { method: "GET", path: "/api/v1/experiments", headers: apiAuth },
      { status: 200, body: EXPERIMENTS_LIST_FIXTURE },
    ),
    step(
      "archive-experiment",
      { method: "DELETE", path: `/api/v1/experiments/${EXPERIMENT_ID}`, headers: apiAuth },
      { status: 204 },
    ),
    step(
      "restore-experiment",
      {
        method: "POST",
        path: `/api/v1/experiments/${EXPERIMENT_ID}/restore`,
        headers: apiAuth,
      },
      { status: 200, body: EXPERIMENT_CONCLUDED_FIXTURE },
    ),
  ],
};

/** Analytics reads: batched insights, captured events, and the ingest policy. */
export const apiAnalyticsSuite: ConformanceSuite = {
  name: "api/analytics",
  category: "api",
  description:
    "Insights query batch, captured-event listing, and the ingest-policy read plus its two admission toggles.",
  steps: [
    step(
      "query-insights",
      {
        method: "POST",
        path: "/api/v1/analytics/queries/insights",
        headers: apiAuth,
        body: {
          queries: [
            {
              insightId: "builtin/revenue",
              key: "revenue",
              timeRange: { preset: "last_30d" },
            },
          ],
        },
      },
      { status: 200, body: QUERY_INSIGHTS_RESULT_FIXTURE },
    ),
    step("list-events", { method: "GET", path: "/api/v1/events", headers: apiAuth }, {
      status: 200,
      body: EVENTS_LIST_FIXTURE,
    }),
    step(
      "get-ingest-policy",
      { method: "GET", path: "/api/v1/ingest-policy", headers: apiAuth },
      { status: 200, body: INGEST_POLICY_FIXTURE },
    ),
    step(
      "disable-builtin-event",
      {
        method: "PUT",
        path: `/api/v1/ingest-policy/builtin-events/${INGEST_BUILTIN_EVENT_KEY}`,
        headers: apiAuth,
        body: { enabled: false },
      },
      { status: 200, body: INGEST_POLICY_BUILTIN_DISABLED_FIXTURE },
    ),
    step(
      "block-custom-event",
      {
        method: "PUT",
        path: `/api/v1/ingest-policy/custom-events/${BLOCKED_CUSTOM_EVENT_NAME}`,
        headers: apiAuth,
        body: { blocked: true },
      },
      { status: 200, body: INGEST_POLICY_CUSTOM_BLOCKED_FIXTURE },
    ),
  ],
};

/** Development sandbox management driven with `x-environment: development`. */
export const apiDevelopmentSuite: ConformanceSuite = {
  name: "api/development",
  category: "api",
  description:
    "Sandbox settings get/update, per-person state, lifecycle-action dispatch (202), and data reset.",
  steps: [
    step(
      "get-development-settings",
      { method: "GET", path: "/api/v1/development/settings", headers: developmentAuth },
      { status: 200, body: DEVELOPMENT_SETTINGS_FIXTURE },
    ),
    step(
      "update-development-settings",
      {
        method: "PATCH",
        path: "/api/v1/development/settings",
        headers: developmentAuth,
        body: { developmentPurchasesEnabled: false },
      },
      { status: 200, body: DEVELOPMENT_SETTINGS_DISABLED_FIXTURE },
    ),
    // `personId` travels as a query parameter; query strings are not matched.
    step(
      "get-development-state",
      { method: "GET", path: "/api/v1/development/state", headers: developmentAuth },
      { status: 200, body: DEVELOPMENT_STATE_FIXTURE },
    ),
    step(
      "apply-lifecycle-action",
      {
        method: "POST",
        path: "/api/v1/development/lifecycle-actions",
        headers: developmentAuth,
        body: {
          action: "renew",
          actionId: DEVELOPMENT_LIFECYCLE_ACTION_ID,
          targetId: DEVELOPMENT_SUBSCRIPTION_ID,
          targetType: "subscription",
        },
      },
      { status: 202, body: DEVELOPMENT_LIFECYCLE_ACTION_ACCEPTED_FIXTURE },
    ),
    step(
      "reset-development-data",
      { method: "DELETE", path: "/api/v1/development/data", headers: developmentAuth },
      { status: 204 },
    ),
  ],
};

/** Push provider (FCM/APNs) configuration lifecycle. */
export const apiPushNotificationConfigurationsSuite: ConformanceSuite = {
  name: "api/push-notification-configurations",
  category: "api",
  description:
    "Push configuration create/get/update/list/delete for a project's FCM provider.",
  steps: [
    step(
      "create-configuration",
      {
        method: "POST",
        path: "/api/v1/push-notification-configurations",
        headers: apiAuth,
        body: { providerId: "fcm" },
      },
      { status: 201, body: PUSH_NOTIFICATION_CONFIGURATION_FIXTURE },
    ),
    step(
      "get-configuration",
      {
        method: "GET",
        path: `/api/v1/push-notification-configurations/${PUSH_NOTIFICATION_CONFIGURATION_ID}`,
        headers: apiAuth,
      },
      { status: 200, body: PUSH_NOTIFICATION_CONFIGURATION_FIXTURE },
    ),
    step(
      "update-configuration",
      {
        method: "PATCH",
        path: `/api/v1/push-notification-configurations/${PUSH_NOTIFICATION_CONFIGURATION_ID}`,
        headers: apiAuth,
        body: {
          configuration: { serviceAccountJson: '{"project_id":"conformance"}' },
          enabled: true,
          name: "Conformance FCM",
        },
      },
      { status: 200, body: PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE },
    ),
    step(
      "list-configurations",
      { method: "GET", path: "/api/v1/push-notification-configurations", headers: apiAuth },
      { status: 200, body: PUSH_NOTIFICATION_CONFIGURATIONS_LIST_FIXTURE },
    ),
    step(
      "delete-configuration",
      {
        method: "DELETE",
        path: `/api/v1/push-notification-configurations/${PUSH_NOTIFICATION_CONFIGURATION_ID}`,
        headers: apiAuth,
      },
      { status: 204 },
    ),
  ],
};

/** Push send history reads: fan-out rows and per-device deliveries. */
export const apiNotificationSendsSuite: ConformanceSuite = {
  name: "api/notification-sends",
  category: "api",
  description: "Notification send history listing and one send's delivery trail.",
  steps: [
    step(
      "list-notification-sends",
      { method: "GET", path: "/api/v1/notification-sends", headers: apiAuth },
      { status: 200, body: NOTIFICATION_SENDS_LIST_FIXTURE },
    ),
    step(
      "list-notification-send-deliveries",
      {
        method: "GET",
        path: `/api/v1/notification-sends/${PUSH_SEND_ID}/deliveries`,
        headers: apiAuth,
      },
      { status: 200, body: NOTIFICATION_DELIVERIES_LIST_FIXTURE },
    ),
  ],
};
