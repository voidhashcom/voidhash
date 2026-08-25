// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement, effect/noAs, effect/noTryCatch -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import {
  ACTIVATED_PAYWALL_RELEASE_FIXTURE,
  API_KEY_FIXTURE,
  API_KEY_ID,
  API_KEY_WITH_RAW_KEY_FIXTURE,
  API_PERSONS_LIST_FIXTURE,
  API_PERSON_FIXTURE,
  API_PRODUCTS_FIXTURE,
  API_SECRET_KEY,
  BLOCKED_CUSTOM_EVENT_NAME,
  CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  DEPLOY_BLOB_SHA256,
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
  FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  HarnessClient,
  INGEST_BUILTIN_EVENT_KEY,
  INGEST_POLICY_BUILTIN_DISABLED_FIXTURE,
  INGEST_POLICY_CUSTOM_BLOCKED_FIXTURE,
  INGEST_POLICY_FIXTURE,
  INVALID_API_SECRET_KEY,
  NOTIFICATION_DELIVERIES_LIST_FIXTURE,
  NOTIFICATION_SENDS_LIST_FIXTURE,
  ORGANIZATION_FIXTURE,
  ORGANIZATION_ID,
  ORGANIZATION_RENAMED_FIXTURE,
  ORGANIZATIONS_LIST_FIXTURE,
  PAYWALL_DEPLOY_FIXTURE,
  PAYWALL_DEPLOYS_LIST_FIXTURE,
  PAYWALL_FIXTURE,
  PAYWALL_ID,
  PAYWALL_LOCATION_FIXTURE,
  PAYWALL_LOCATION_ID,
  PAYWALL_LOCATION_RENAMED_FIXTURE,
  PAYWALL_LOCATION_SHOWING_FIXTURE,
  PAYWALL_LOCATION_SHOWINGS_LIST_FIXTURE,
  PAYWALL_LOCATIONS_LIST_FIXTURE,
  PAYWALL_RELEASE_DRAFT_FIXTURE,
  PAYWALL_RELEASE_ID,
  PAYWALL_RELEASE_PUBLISHED_FIXTURE,
  PAYWALL_RELEASES_LIST_FIXTURE,
  PAYWALL_RENAMED_FIXTURE,
  PAYWALL_SLUG,
  PAYWALLS_LIST_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_ENABLED_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATION_ID,
  PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_PRODUCT_ACTIVE_FIXTURE,
  PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE,
  PAYMENT_PROVIDER_PRODUCT_ID,
  PAYMENT_PROVIDER_PRODUCT_UPDATED_FIXTURE,
  PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE,
  PERSON_ENTITLEMENTS_FIXTURE,
  PERSON_ID,
  PERK_FIXTURE,
  PERK_ID,
  PERK_RENAMED_FIXTURE,
  PERKS_LIST_FIXTURE,
  PRODUCT_DETAIL_FIXTURE,
  PRODUCT_ID,
  PRODUCT_PERK_FIXTURE,
  PRODUCT_PERKS_LIST_FIXTURE,
  PRODUCT_RENAMED_FIXTURE,
  PRODUCT_SLUG,
  PROJECTS_LIST_FIXTURE,
  PROJECT_FIXTURE,
  PROJECT_ID,
  PROJECT_RENAMED_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_FIXTURE,
  PUSH_NOTIFICATION_CONFIGURATION_ID,
  PUSH_NOTIFICATION_CONFIGURATIONS_LIST_FIXTURE,
  PUSH_SEND_ID,
  QUERY_INSIGHTS_RESULT_FIXTURE,
  renderReport,
  SCHEMA_FIXTURE,
  SCHEMA_VERSION_FIXTURE,
  SEND_NOTIFICATION_RESPONSE_FIXTURE,
  SESSION_FIXTURE,
  startHarness,
  UPLOAD_PAYWALL_DEPLOY_BLOB_RESPONSE_FIXTURE,
  WEBHOOK_DELIVERY_FIXTURE,
  WEBHOOK_DELIVERY_ID,
  WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE,
  WEBHOOK_ENDPOINT_DISABLED_FIXTURE,
  WEBHOOK_ENDPOINT_FIXTURE,
  WEBHOOK_ENDPOINT_ID,
  type HarnessHandle,
} from "@voidhash/sdk-test-harness";
import type {
  AnalyticsInsightQuery,
  ReplaceFeatureFlagVariantsBodyJsonEncoding,
} from "@voidhash/generated-clients";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createVoidhashSdk, type VoidhashNodeClient } from "../src/index";

/**
 * Conformance runner for @voidhash/node: executes every shared `api/*`
 * scenario suite against the harness server using the real SDK client and
 * verifies both the SDK's return values and the wire-level expectations
 * (method, path, exact headers, bodies, ordering).
 */

const expectRejection = async (promise: Promise<unknown>, tag?: string): Promise<void> => {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  if (tag !== undefined) {
    // The generated client wraps error responses: `_tag` is the codegen
    // wrapper tag, `data` is the decoded wire body carrying the API's
    // `Api/…` discriminator.
    const wireTag = (error as { data?: { _tag?: string } }).data?._tag;
    expect(wireTag ?? (error as { _tag?: string })._tag, tag).toBe(tag);
  }
};

describe("node sdk conformance (api suites)", () => {
  let handle: HarnessHandle;
  let harness: HarnessClient;

  beforeAll(async () => {
    handle = await startHarness();
    harness = HarnessClient.forHandle(handle);
  });

  afterAll(async () => {
    await handle.shutdown();
  });

  const runSuite = async (
    suiteName: string,
    execute: (
      sdk: VoidhashNodeClient,
      makeClient: (
        secretKey: string,
        extraHeaders?: Record<string, string>,
      ) => VoidhashNodeClient,
    ) => Promise<void>,
  ): Promise<void> => {
    const session = await harness.createSession(suiteName);
    const makeClient = (
      secretKey: string,
      extraHeaders?: Record<string, string>,
    ): VoidhashNodeClient =>
      createVoidhashSdk({
        baseUrl: handle.url,
        headers: { "x-harness-session": session.sessionId, ...extraHeaders },
        secretKey,
      });
    const sdk = makeClient(API_SECRET_KEY);
    let report: Awaited<ReturnType<HarnessClient["completeSession"]>>;
    try {
      await execute(sdk, makeClient);
    } finally {
      // Always close the session so one failing suite does not wedge the
      // harness's single-active-session slot for the remaining suites.
      report = await harness.completeSession(session.sessionId);
    }
    expect(report.pass, renderReport(report)).toBe(true);
  };

  it("api/core", async () => {
    await runSuite("api/core", async (sdk) => {
      expect(await sdk.schema.getSchema({ params: { projectId: undefined } })).toEqual(
        SCHEMA_FIXTURE,
      );
      expect(
        await sdk.products.listProducts({
          params: { cursor: undefined, limit: undefined, projectId: undefined, type: undefined },
        }),
      ).toEqual(API_PRODUCTS_FIXTURE);

      expect(
        await sdk.persons.createPerson({
          payload: { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
        }),
      ).toEqual(API_PERSON_FIXTURE);

      // The distinct-id lookup is a filter on the list endpoint.
      expect(
        await sdk.persons.listPersons({
          params: {
            cursor: undefined,
            limit: undefined,
            distinctId: DISTINCT_ID,
            email: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(API_PERSONS_LIST_FIXTURE);

      expect(
        await sdk.persons.listPersons({
          params: {
            cursor: undefined,
            limit: undefined,
            distinctId: undefined,
            email: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(API_PERSONS_LIST_FIXTURE);
      expect(await sdk.persons.getPersonById({ params: { personId: PERSON_ID } })).toEqual(
        API_PERSON_FIXTURE,
      );
      expect(
        await sdk.persons.updatePerson({
          params: { personId: PERSON_ID },
          payload: { traits: { notes_created: 3, plan: "pro" } },
        }),
      ).toEqual(API_PERSON_FIXTURE);

      expect(
        await sdk.persons.getPersonEntitlements({ params: { personId: PERSON_ID } }),
      ).toEqual(PERSON_ENTITLEMENTS_FIXTURE);

      // Scripted failures must surface as errors, never as junk values.
      await expectRejection(
        sdk.persons.getPersonById({ params: { personId: "person_conformance_missing" } }),
        "Api/PersonNotFoundError",
      );

      expect(await sdk.schema.getSchemaVersion({ params: { projectId: undefined } })).toEqual(
        SCHEMA_VERSION_FIXTURE,
      );
      await expectRejection(sdk.users.getUser(), "Api/NotAuthenticatedError");
    });
  });

  it("api/auth", async () => {
    await runSuite("api/auth", async (sdk, makeClient) => {
      expect(await sdk.auth.session()).toEqual(SESSION_FIXTURE);
      await expectRejection(sdk.auth.session(), "Api/ActionForbiddenError");

      // Step order mirrors the suite: the invalid-key exchange comes before
      // the forbidden-list step.
      const invalidSdk = makeClient(INVALID_API_SECRET_KEY);
      await expectRejection(invalidSdk.users.getUser(), "Api/NotAuthenticatedError");

      await expectRejection(
        sdk.products.listProducts({
          params: { cursor: undefined, limit: undefined, projectId: undefined, type: undefined },
        }),
        "Api/ActionForbiddenError",
      );
    });
  });

  it("api/projects-orgs", async () => {
    await runSuite("api/projects-orgs", async (sdk) => {
      expect(
        await sdk.organizations.createOrganization({ payload: { name: "Conformance Org" } }),
      ).toEqual({ id: ORGANIZATION_ID, name: "Conformance Org", slug: "conformance-org" });
      expect(
        await sdk.projects.createProject({
          payload: { name: "Conformance Project", organizationId: ORGANIZATION_ID },
        }),
      ).toEqual(PROJECT_FIXTURE);
      expect(
        await sdk.organizations.listOrganizationProjects({
          params: { organizationId: ORGANIZATION_ID, cursor: undefined, limit: undefined },
        }),
      ).toEqual(PROJECTS_LIST_FIXTURE);
    });
  });

  it("api/api-keys", async () => {
    await runSuite("api/api-keys", async (sdk) => {
      expect(
        await sdk.apiKeys.createSecretKey({
          payload: { name: "Conformance Secret Key", projectId: "proj_conformance_001" },
        }),
      ).toEqual(API_KEY_WITH_RAW_KEY_FIXTURE);
      expect(
        await sdk.apiKeys.listApiKeys({
          params: { cursor: undefined, limit: undefined, projectId: undefined },
        }),
      ).toEqual([API_KEY_FIXTURE]);
      expect(await sdk.apiKeys.getApiKeyById({ params: { apiKeyId: API_KEY_ID } })).toEqual(
        API_KEY_FIXTURE,
      );
      expect(await sdk.apiKeys.rotateSecretKey({ params: { apiKeyId: API_KEY_ID } })).toEqual(
        API_KEY_WITH_RAW_KEY_FIXTURE,
      );
      expect(await sdk.apiKeys.deleteApiKey({ params: { apiKeyId: API_KEY_ID } })).toBeUndefined();
      await expectRejection(
        sdk.apiKeys.getApiKeyById({ params: { apiKeyId: "ak_conformance_missing" } }),
        "Api/ApiKeyNotFoundError",
      );
    });
  });

  it("api/webhooks", async () => {
    await runSuite("api/webhooks", async (sdk) => {
      expect(
        await sdk.webhooks.createWebhookEndpoint({
          payload: {
            events: ["purchase.completed", "subscription.created"],
            name: "Conformance Endpoint",
            url: "https://hooks.conformance.voidhash.test/receive",
          },
        }),
      ).toEqual(WEBHOOK_ENDPOINT_FIXTURE);
      expect(
        await sdk.webhooks.listWebhookEndpoints({
          params: { cursor: undefined, limit: undefined, projectId: undefined },
        }),
      ).toEqual([WEBHOOK_ENDPOINT_FIXTURE]);
      expect(
        await sdk.webhooks.getWebhookEndpoint({
          params: { endpointId: WEBHOOK_ENDPOINT_ID, projectId: undefined },
        }),
      ).toEqual(WEBHOOK_ENDPOINT_FIXTURE);
      // NOTE: `scripts/generate-node-grouped-client.mjs` still spreads query
      // parameters positionally, so for the endpoints that take both a query
      // parameter and a JSON body the generated group types (and calls) are
      // wrong. This call spells out the intended shape; it type-checks and
      // runs once the generator emits a single options object.
      expect(
        await sdk.webhooks.updateWebhookEndpoint({
          params: { endpointId: WEBHOOK_ENDPOINT_ID, projectId: undefined },
          payload: {
            description: "Rotated",
            events: ["purchase.completed"],
            status: "disabled",
          },
        }),
      ).toEqual(WEBHOOK_ENDPOINT_DISABLED_FIXTURE);
      expect(
        await sdk.webhooks.rotateWebhookSecret({
          params: { endpointId: WEBHOOK_ENDPOINT_ID, projectId: undefined },
        }),
      ).toEqual(WEBHOOK_ENDPOINT_DISABLED_FIXTURE);
      expect(
        await sdk.webhooks.testWebhookEndpoint({
          params: { endpointId: WEBHOOK_ENDPOINT_ID, projectId: undefined },
        }),
      ).toEqual(WEBHOOK_DELIVERY_FIXTURE);
      expect(
        await sdk.webhooks.deleteWebhookEndpoint({
          params: { endpointId: WEBHOOK_ENDPOINT_ID, projectId: undefined },
        }),
      ).toBeUndefined();

      await expectRejection(
        sdk.webhooks.createWebhookEndpoint({
          payload: {
            events: ["purchase.completed"],
            name: "Bad Endpoint",
            url: "not-a-url",
          },
        }),
        "Api/WebhookValidationError",
      );
      await expectRejection(
        sdk.webhooks.getWebhookEndpoint({
          params: { endpointId: "wh_conformance_missing", projectId: undefined },
        }),
        "Api/WebhookEndpointNotFoundError",
      );

      expect(
        await sdk.webhooks.listWebhookDeliveries({
          params: {
            cursor: undefined,
            limit: undefined,
            endpointId: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual([WEBHOOK_DELIVERY_FIXTURE]);
      expect(
        await sdk.webhooks.getWebhookDelivery({
          params: { deliveryId: WEBHOOK_DELIVERY_ID, projectId: undefined },
        }),
      ).toEqual(WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE);
      expect(
        await sdk.webhooks.retryWebhookDelivery({
          params: { deliveryId: WEBHOOK_DELIVERY_ID, projectId: undefined },
        }),
      ).toEqual(WEBHOOK_DELIVERY_FIXTURE);
    });
  });

  it("api/catalog", async () => {
    await runSuite("api/catalog", async (sdk) => {
      expect(
        await sdk.perks.listPerks({
          params: { cursor: undefined, limit: undefined, projectId: undefined },
        }),
      ).toEqual(PERKS_LIST_FIXTURE);
      expect(
        await sdk.paywallLocations.listPaywallLocations({
          params: {
            cursor: undefined,
            limit: undefined,
            includeArchived: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(PAYWALL_LOCATIONS_LIST_FIXTURE);
      expect(
        await sdk.products.listProductPerks({
          params: { productId: "prod_monthly", cursor: undefined, limit: undefined },
        }),
      ).toEqual(PRODUCT_PERKS_LIST_FIXTURE);
      expect(
        await sdk.paymentProviderConfigurations.listPaymentProviderConfigurations({
          params: {
            cursor: undefined,
            limit: undefined,
            projectId: undefined,
            providerId: undefined,
          },
        }),
      ).toEqual(PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.listPaymentProviderProducts({
          params: {
            cursor: undefined,
            limit: undefined,
            paymentProviderConfigurationId: undefined,
            productId: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE);
    });
  });

  it("api/notifications", async () => {
    await runSuite("api/notifications", async (sdk) => {
      expect(
        await sdk.notifications.createNotification({
          payload: {
            payload: {
              badge: 1,
              body: "Conformance push",
              collapseId: `collapse-push_send_conformance_001`,
              data: { source: "conformance" },
              distinctIds: [DISTINCT_ID],
              personIds: [PERSON_ID],
              priority: "high",
              sound: "default",
              title: "Conformance",
              ttl: 3600,
            },
          },
        }),
      ).toEqual(SEND_NOTIFICATION_RESPONSE_FIXTURE);
      await expectRejection(
        sdk.notifications.createNotification({
          payload: {
            payload: {
              body: "Conformance push",
              distinctIds: [`missing-${DISTINCT_ID}`],
              title: "Conformance",
            },
          },
        }),
        "Api/PushSendNotEnabledError",
      );
    });
  });

  it("api/paywall-deploys", async () => {
    await runSuite("api/paywall-deploys", async (sdk) => {
      expect(
        await sdk.paywallDeploys.createDeploy({
          payload: {
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
        }),
      ).toEqual(CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE);

      // NOTE: the generated TS client cannot transmit octet-stream bodies yet,
      // so this verifies URL construction, auth, and status mapping only.
      // Binary-capable SDKs must send the declared blob bytes here.
      expect(
        await sdk.paywallDeploys.uploadBlob({
          params: { deployId: DEPLOY_ID, sha256: DEPLOY_BLOB_SHA256 },
        }),
      ).toEqual(UPLOAD_PAYWALL_DEPLOY_BLOB_RESPONSE_FIXTURE);

      await expectRejection(
        sdk.paywallDeploys.uploadBlob({
          params: { deployId: DEPLOY_ID, sha256: DEPLOY_BLOB_SHA256 },
        }),
        "Api/DeployBlobHashMismatchError",
      );

      expect(
        await sdk.paywallDeploys.finalizeDeploy({ params: { deployId: DEPLOY_ID } }),
      ).toEqual(FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE);
      await expectRejection(
        sdk.paywallDeploys.finalizeDeploy({ params: { deployId: DEPLOY_ID } }),
        "Api/IncompleteDeployError",
      );
    });
  });

  it("api/organizations", async () => {
    await runSuite("api/organizations", async (sdk) => {
      expect(
        await sdk.organizations.listOrganizations({
          params: { cursor: undefined, limit: undefined },
        }),
      ).toEqual(ORGANIZATIONS_LIST_FIXTURE);
      expect(
        await sdk.organizations.getOrganization({ params: { organizationId: ORGANIZATION_ID } }),
      ).toEqual(ORGANIZATION_FIXTURE);
      expect(
        await sdk.organizations.updateOrganization({
          params: { organizationId: ORGANIZATION_ID },
          payload: { name: "Conformance Org Renamed" },
        }),
      ).toEqual(ORGANIZATION_RENAMED_FIXTURE);
      expect(await sdk.projects.getProjectById({ params: { projectId: PROJECT_ID } })).toEqual(
        PROJECT_FIXTURE,
      );
      expect(
        await sdk.projects.updateProject({
          params: { projectId: PROJECT_ID },
          payload: { name: "Conformance Project Renamed" },
        }),
      ).toEqual(PROJECT_RENAMED_FIXTURE);
      expect(
        await sdk.projects.deleteProject({ params: { projectId: PROJECT_ID } }),
      ).toBeUndefined();
    });
  });

  it("api/products", async () => {
    await runSuite("api/products", async (sdk) => {
      expect(
        await sdk.perks.createPerk({ payload: { name: "All Access", slug: "all-access" } }),
      ).toEqual(PERK_FIXTURE);
      expect(await sdk.perks.getPerk({ params: { perkId: PERK_ID } })).toEqual(PERK_FIXTURE);
      expect(
        await sdk.perks.updatePerk({
          params: { perkId: PERK_ID },
          payload: { name: "All Access Plus" },
        }),
      ).toEqual(PERK_RENAMED_FIXTURE);
      expect(
        await sdk.products.createProduct({
          payload: { duration: 30, name: "Monthly", slug: PRODUCT_SLUG, type: "subscription" },
        }),
      ).toEqual(PRODUCT_DETAIL_FIXTURE);
      expect(await sdk.products.getProduct({ params: { productId: PRODUCT_ID } })).toEqual(
        PRODUCT_DETAIL_FIXTURE,
      );
      expect(
        await sdk.products.updateProduct({
          params: { productId: PRODUCT_ID },
          payload: { name: "Monthly Plus" },
        }),
      ).toEqual(PRODUCT_RENAMED_FIXTURE);
      expect(
        await sdk.products.attachProductPerk({
          params: { productId: PRODUCT_ID },
          payload: { perkId: PERK_ID },
        }),
      ).toEqual(PRODUCT_PERK_FIXTURE);
      expect(
        await sdk.products.detachProductPerk({
          params: { perkId: PERK_ID, productId: PRODUCT_ID },
        }),
      ).toBeUndefined();
      expect(
        await sdk.products.deleteProduct({ params: { productId: PRODUCT_ID } }),
      ).toBeUndefined();
      expect(await sdk.perks.deletePerk({ params: { perkId: PERK_ID } })).toBeUndefined();
    });
  });

  it("api/payment-providers", async () => {
    await runSuite("api/payment-providers", async (sdk) => {
      expect(
        await sdk.paymentProviderConfigurations.createPaymentProviderConfiguration({
          payload: { providerId: "stripe" },
        }),
      ).toEqual(PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE);
      expect(
        await sdk.paymentProviderConfigurations.getPaymentProviderConfiguration({
          params: { configurationId: PAYMENT_PROVIDER_CONFIGURATION_ID },
        }),
      ).toEqual(PAYMENT_PROVIDER_CONFIGURATION_DETAIL_FIXTURE);
      expect(
        await sdk.paymentProviderConfigurations.updatePaymentProviderConfiguration({
          params: { configurationId: PAYMENT_PROVIDER_CONFIGURATION_ID },
          payload: {
            configuration: { secretKey: "sk_live_conformance_001" },
            enabled: true,
            name: "Stripe Production",
          },
        }),
      ).toEqual(PAYMENT_PROVIDER_CONFIGURATION_ENABLED_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.createPaymentProviderProduct({
          payload: {
            configuration: { productId: "price_conformance_001" },
            paymentProviderConfigurationId: PAYMENT_PROVIDER_CONFIGURATION_ID,
            productId: PRODUCT_ID,
          },
        }),
      ).toEqual(PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.getPaymentProviderProduct({
          params: { mappingId: PAYMENT_PROVIDER_PRODUCT_ID },
        }),
      ).toEqual(PAYMENT_PROVIDER_PRODUCT_DETAIL_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.updatePaymentProviderProduct({
          params: { mappingId: PAYMENT_PROVIDER_PRODUCT_ID },
          payload: { configuration: { productId: "price_conformance_002" } },
        }),
      ).toEqual(PAYMENT_PROVIDER_PRODUCT_UPDATED_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.activatePaymentProviderProduct({
          params: { mappingId: PAYMENT_PROVIDER_PRODUCT_ID },
        }),
      ).toEqual(PAYMENT_PROVIDER_PRODUCT_ACTIVE_FIXTURE);
      expect(
        await sdk.paymentProviderProducts.deletePaymentProviderProduct({
          params: { mappingId: PAYMENT_PROVIDER_PRODUCT_ID },
        }),
      ).toBeUndefined();
      expect(
        await sdk.paymentProviderConfigurations.deletePaymentProviderConfiguration({
          params: { configurationId: PAYMENT_PROVIDER_CONFIGURATION_ID },
        }),
      ).toBeUndefined();
    });
  });

  it("api/paywalls", async () => {
    await runSuite("api/paywalls", async (sdk) => {
      expect(
        await sdk.paywalls.createPaywall({
          payload: { name: "Conformance Paywall", slug: PAYWALL_SLUG },
        }),
      ).toEqual(PAYWALL_FIXTURE);
      expect(await sdk.paywalls.getPaywall({ params: { paywallId: PAYWALL_ID } })).toEqual(
        PAYWALL_FIXTURE,
      );
      expect(
        await sdk.paywalls.updatePaywall({
          params: { paywallId: PAYWALL_ID },
          payload: { name: "Conformance Paywall v2" },
        }),
      ).toEqual(PAYWALL_RENAMED_FIXTURE);
      expect(
        await sdk.paywalls.listPaywalls({
          params: {
            cursor: undefined,
            limit: undefined,
            includeArchived: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(PAYWALLS_LIST_FIXTURE);
      expect(
        await sdk.paywalls.createPaywallRelease({ params: { paywallId: PAYWALL_ID } }),
      ).toEqual(PAYWALL_RELEASE_DRAFT_FIXTURE);
      expect(
        await sdk.paywalls.listPaywallReleases({
          params: { paywallId: PAYWALL_ID, cursor: undefined, limit: undefined, status: undefined },
        }),
      ).toEqual(PAYWALL_RELEASES_LIST_FIXTURE);
      expect(
        await sdk.paywalls.publishPaywallRelease({
          params: { paywallId: PAYWALL_ID, releaseId: PAYWALL_RELEASE_ID },
        }),
      ).toEqual(PAYWALL_RELEASE_PUBLISHED_FIXTURE);
      expect(
        await sdk.paywalls.activatePaywallRelease({
          params: { paywallId: PAYWALL_ID, releaseId: PAYWALL_RELEASE_ID },
        }),
      ).toEqual(ACTIVATED_PAYWALL_RELEASE_FIXTURE);
      expect(
        await sdk.paywalls.archivePaywall({ params: { paywallId: PAYWALL_ID } }),
      ).toBeUndefined();
      expect(await sdk.paywalls.restorePaywall({ params: { paywallId: PAYWALL_ID } })).toEqual(
        PAYWALL_RENAMED_FIXTURE,
      );
    });
  });

  it("api/paywall-locations", async () => {
    await runSuite("api/paywall-locations", async (sdk) => {
      expect(
        await sdk.paywallLocations.createPaywallLocation({
          payload: { name: "Onboarding", slug: "onboarding" },
        }),
      ).toEqual(PAYWALL_LOCATION_FIXTURE);
      expect(
        await sdk.paywallLocations.getPaywallLocation({
          params: { locationId: PAYWALL_LOCATION_ID, projectId: undefined },
        }),
      ).toEqual(PAYWALL_LOCATION_FIXTURE);
      expect(
        await sdk.paywallLocations.updatePaywallLocation({
          params: { locationId: PAYWALL_LOCATION_ID },
          payload: { description: "Shown after signup", name: "Onboarding Updated" },
        }),
      ).toEqual(PAYWALL_LOCATION_RENAMED_FIXTURE);
      expect(
        await sdk.paywallLocations.setPaywallLocationShowing({
          params: { locationId: PAYWALL_LOCATION_ID },
          payload: { paywallId: PAYWALL_ID, type: "paywall_release" },
        }),
      ).toEqual(PAYWALL_LOCATION_SHOWING_FIXTURE);
      expect(
        await sdk.paywallLocations.listPaywallLocationShowings({
          params: { locationId: PAYWALL_LOCATION_ID, cursor: undefined, limit: undefined },
        }),
      ).toEqual(PAYWALL_LOCATION_SHOWINGS_LIST_FIXTURE);
      expect(
        await sdk.paywallLocations.clearPaywallLocationShowing({
          params: { locationId: PAYWALL_LOCATION_ID },
        }),
      ).toBeUndefined();
      expect(
        await sdk.paywallLocations.archivePaywallLocation({
          params: { locationId: PAYWALL_LOCATION_ID },
        }),
      ).toBeUndefined();
    });
  });

  it("api/paywall-deploy-reads", async () => {
    await runSuite("api/paywall-deploy-reads", async (sdk) => {
      expect(
        await sdk.paywallDeploys.listDeploys({
          params: { cursor: undefined, limit: undefined, projectId: undefined, status: undefined },
        }),
      ).toEqual(PAYWALL_DEPLOYS_LIST_FIXTURE);
      expect(
        await sdk.paywallDeploys.getDeploy({
          params: { deployId: DEPLOY_ID, projectId: undefined },
        }),
      ).toEqual(PAYWALL_DEPLOY_FIXTURE);
    });
  });

  it("api/feature-flags", async () => {
    await runSuite("api/feature-flags", async (sdk) => {
      expect(
        await sdk.featureFlags.createFeatureFlag({ payload: { slug: FEATURE_FLAG_SLUG } }),
      ).toEqual(FEATURE_FLAG_FIXTURE);
      expect(
        await sdk.featureFlags.getFeatureFlag({ params: { featureFlagId: FEATURE_FLAG_ID } }),
      ).toEqual(FEATURE_FLAG_FIXTURE);
      expect(
        await sdk.featureFlags.updateFeatureFlag({
          params: { featureFlagId: FEATURE_FLAG_ID },
          payload: { enabled: true, rolloutBps: 5000 },
        }),
      ).toEqual(FEATURE_FLAG_ENABLED_FIXTURE);
      // NOTE: the OpenAPI-generated body type drops the contract's
      // `value: Schema.Unknown` field, so the assertion restores the field the
      // wire (and the harness's exact body match) requires.
      const replaceVariantsPayload = {
        variants: [{ label: "Treatment", value: true, weightBps: 10000 }],
      } as unknown as ReplaceFeatureFlagVariantsBodyJsonEncoding;
      expect(
        await sdk.featureFlags.replaceFeatureFlagVariants({
          params: { featureFlagId: FEATURE_FLAG_ID },
          payload: replaceVariantsPayload,
        }),
      ).toEqual(FEATURE_FLAG_WITH_VARIANTS_FIXTURE);
      expect(
        await sdk.featureFlags.listFeatureFlags({
          params: {
            cursor: undefined,
            limit: undefined,
            includeArchived: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(FEATURE_FLAGS_LIST_FIXTURE);
      expect(
        await sdk.featureFlags.evaluateProjectFeatureFlags({
          payload: { distinctId: DISTINCT_ID, keys: [FEATURE_FLAG_SLUG] },
        }),
      ).toEqual(EVALUATED_FEATURE_FLAGS_FIXTURE);
      // identityType 2 = distinct id; the wire encoding is the numeric literal.
      expect(
        await sdk.featureFlagOverrides.upsertFeatureFlagOverride({
          payload: {
            featureFlagId: FEATURE_FLAG_ID,
            forcedEnabled: true,
            identityType: 2,
            identityValue: DISTINCT_ID,
          },
        }),
      ).toEqual(FEATURE_FLAG_OVERRIDE_FIXTURE);
      expect(
        await sdk.featureFlagOverrides.listFeatureFlagOverrides({
          params: {
            cursor: undefined,
            limit: undefined,
            featureFlagId: undefined,
            identityType: undefined,
            identityValue: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(FEATURE_FLAG_OVERRIDES_LIST_FIXTURE);
      expect(
        await sdk.featureFlagOverrides.archiveFeatureFlagOverride({
          params: { overrideId: FEATURE_FLAG_OVERRIDE_ID },
        }),
      ).toBeUndefined();
      // listType 1 = allow-list; numeric on the wire like identityType.
      expect(
        await sdk.featureFlagTargets.upsertFeatureFlagTarget({
          payload: {
            featureFlagId: FEATURE_FLAG_ID,
            identityType: 2,
            identityValue: DISTINCT_ID,
            listType: 1,
          },
        }),
      ).toEqual(FEATURE_FLAG_TARGET_FIXTURE);
      expect(
        await sdk.featureFlagTargets.listFeatureFlagTargets({
          params: {
            featureFlagId: FEATURE_FLAG_ID,
            cursor: undefined,
            limit: undefined,
            listType: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(FEATURE_FLAG_TARGETS_LIST_FIXTURE);
      expect(
        await sdk.featureFlagTargets.archiveFeatureFlagTarget({
          params: { targetId: FEATURE_FLAG_TARGET_ID },
        }),
      ).toBeUndefined();
      expect(
        await sdk.featureFlags.archiveFeatureFlag({ params: { featureFlagId: FEATURE_FLAG_ID } }),
      ).toBeUndefined();
      expect(
        await sdk.featureFlags.restoreFeatureFlag({ params: { featureFlagId: FEATURE_FLAG_ID } }),
      ).toEqual(FEATURE_FLAG_WITH_VARIANTS_FIXTURE);
    });
  });

  it("api/experiments", async () => {
    await runSuite("api/experiments", async (sdk) => {
      expect(
        await sdk.experiments.createExperiment({ payload: { name: "Conformance Experiment" } }),
      ).toEqual(EXPERIMENT_DRAFT_FIXTURE);
      expect(
        await sdk.experiments.getExperiment({ params: { experimentId: EXPERIMENT_ID } }),
      ).toEqual(EXPERIMENT_DRAFT_FIXTURE);
      expect(
        await sdk.experiments.updateExperiment({
          params: { experimentId: EXPERIMENT_ID },
          payload: {
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
                treatments: [{ paywallId: PAYWALL_ID, paywallLocationId: PAYWALL_LOCATION_ID }],
                weightBps: 5000,
              },
            ],
          },
        }),
      ).toEqual(EXPERIMENT_CONFIGURED_FIXTURE);
      expect(
        await sdk.experiments.startExperiment({ params: { experimentId: EXPERIMENT_ID } }),
      ).toEqual(EXPERIMENT_RUNNING_FIXTURE);
      expect(
        await sdk.experiments.pauseExperiment({ params: { experimentId: EXPERIMENT_ID } }),
      ).toEqual(EXPERIMENT_PAUSED_FIXTURE);
      expect(
        await sdk.experiments.concludeExperiment({
          params: { experimentId: EXPERIMENT_ID },
          payload: { winningVariantId: EXPERIMENT_TREATMENT_VARIANT_ID },
        }),
      ).toEqual(EXPERIMENT_CONCLUDED_FIXTURE);
      expect(
        await sdk.experiments.getExperimentResults({
          params: { experimentId: EXPERIMENT_ID, days: undefined },
        }),
      ).toEqual(EXPERIMENT_RESULTS_FIXTURE);
      expect(
        await sdk.experiments.listExperiments({
          params: {
            cursor: undefined,
            limit: undefined,
            includeArchived: undefined,
            projectId: undefined,
            status: undefined,
          },
        }),
      ).toEqual(EXPERIMENTS_LIST_FIXTURE);
      expect(
        await sdk.experiments.archiveExperiment({ params: { experimentId: EXPERIMENT_ID } }),
      ).toBeUndefined();
      expect(
        await sdk.experiments.restoreExperiment({ params: { experimentId: EXPERIMENT_ID } }),
      ).toEqual(EXPERIMENT_CONCLUDED_FIXTURE);
    });
  });

  it("api/analytics", async () => {
    await runSuite("api/analytics", async (sdk) => {
      // NOTE: the OpenAPI-generated timeRange type collapsed the contract's
      // preset union (`last_7d` | `last_30d` | ...) down to the literal
      // "custom", so the query is asserted to send the preset the contract
      // (and the harness's exact body match) expects.
      const revenueInsightQuery = {
        insightId: "builtin/revenue",
        key: "revenue",
        timeRange: { preset: "last_30d" },
      } as unknown as AnalyticsInsightQuery;
      expect(
        await sdk.analytics.queryInsights({
          payload: { queries: [revenueInsightQuery] },
        }),
      ).toEqual(QUERY_INSIGHTS_RESULT_FIXTURE);
      expect(
        await sdk.events.listEvents({
          params: {
            cursor: undefined,
            limit: undefined,
            eventName: undefined,
            projectId: undefined,
          },
        }),
      ).toEqual(EVENTS_LIST_FIXTURE);
      expect(await sdk.ingestPolicy.getIngestPolicy({ params: { projectId: undefined } })).toEqual(
        INGEST_POLICY_FIXTURE,
      );
      expect(
        await sdk.ingestPolicy.setBuiltinEventAdmission({
          params: { key: INGEST_BUILTIN_EVENT_KEY },
          payload: { enabled: false },
        }),
      ).toEqual(INGEST_POLICY_BUILTIN_DISABLED_FIXTURE);
      expect(
        await sdk.ingestPolicy.setCustomEventBlocked({
          params: { eventName: BLOCKED_CUSTOM_EVENT_NAME },
          payload: { blocked: true },
        }),
      ).toEqual(INGEST_POLICY_CUSTOM_BLOCKED_FIXTURE);
    });
  });

  it("api/development", async () => {
    await runSuite("api/development", async (_sdk, makeClient) => {
      // Every development step must carry `x-environment: development`, so the
      // whole suite runs on a dedicated client with the header set once.
      const devSdk = makeClient(API_SECRET_KEY, { "x-environment": "development" });
      expect(
        await devSdk.development.getDevelopmentSettings({ params: { projectId: undefined } }),
      ).toEqual(DEVELOPMENT_SETTINGS_FIXTURE);
      expect(
        await devSdk.development.updateDevelopmentSettings({
          payload: { developmentPurchasesEnabled: false },
        }),
      ).toEqual(DEVELOPMENT_SETTINGS_DISABLED_FIXTURE);
      expect(
        await devSdk.development.getDevelopmentState({
          params: { personId: PERSON_ID, projectId: undefined },
        }),
      ).toEqual(DEVELOPMENT_STATE_FIXTURE);
      expect(
        await devSdk.development.applyDevelopmentLifecycleAction({
          payload: {
            action: "renew",
            actionId: DEVELOPMENT_LIFECYCLE_ACTION_ID,
            targetId: DEVELOPMENT_SUBSCRIPTION_ID,
            targetType: "subscription",
          },
        }),
      ).toEqual(DEVELOPMENT_LIFECYCLE_ACTION_ACCEPTED_FIXTURE);
      expect(
        await devSdk.development.resetDevelopmentData({ params: { projectId: undefined } }),
      ).toBeUndefined();
    });
  });

  it("api/push-notification-configurations", async () => {
    await runSuite("api/push-notification-configurations", async (sdk) => {
      expect(
        await sdk.pushNotificationConfigurations.createPushNotificationConfiguration({
          payload: { providerId: "fcm" },
        }),
      ).toEqual(PUSH_NOTIFICATION_CONFIGURATION_FIXTURE);
      expect(
        await sdk.pushNotificationConfigurations.getPushNotificationConfiguration({
          params: { configurationId: PUSH_NOTIFICATION_CONFIGURATION_ID },
        }),
      ).toEqual(PUSH_NOTIFICATION_CONFIGURATION_FIXTURE);
      expect(
        await sdk.pushNotificationConfigurations.updatePushNotificationConfiguration({
          params: { configurationId: PUSH_NOTIFICATION_CONFIGURATION_ID },
          payload: {
            configuration: { serviceAccountJson: '{"project_id":"conformance"}' },
            enabled: true,
            name: "Conformance FCM",
          },
        }),
      ).toEqual(PUSH_NOTIFICATION_CONFIGURATION_ENABLED_FIXTURE);
      expect(
        await sdk.pushNotificationConfigurations.listPushNotificationConfigurations({
          params: {
            cursor: undefined,
            limit: undefined,
            projectId: undefined,
            providerId: undefined,
          },
        }),
      ).toEqual(PUSH_NOTIFICATION_CONFIGURATIONS_LIST_FIXTURE);
      expect(
        await sdk.pushNotificationConfigurations.deletePushNotificationConfiguration({
          params: { configurationId: PUSH_NOTIFICATION_CONFIGURATION_ID },
        }),
      ).toBeUndefined();
    });
  });

  it("api/notification-sends", async () => {
    await runSuite("api/notification-sends", async (sdk) => {
      expect(
        await sdk.notificationSends.listNotificationSends({
          params: { cursor: undefined, limit: undefined, projectId: undefined },
        }),
      ).toEqual(NOTIFICATION_SENDS_LIST_FIXTURE);
      expect(
        await sdk.notificationSends.listNotificationSendDeliveries({
          params: {
            sendId: PUSH_SEND_ID,
            cursor: undefined,
            limit: undefined,
            projectId: undefined,
            status: undefined,
          },
        }),
      ).toEqual(NOTIFICATION_DELIVERIES_LIST_FIXTURE);
    });
  });
});
