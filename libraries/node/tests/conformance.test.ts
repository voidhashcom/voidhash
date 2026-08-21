// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement, effect/noAs, effect/noTryCatch -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import {
  API_KEY_FIXTURE,
  API_KEY_ID,
  API_KEY_WITH_RAW_KEY_FIXTURE,
  API_PERSONS_LIST_FIXTURE,
  API_PERSON_FIXTURE,
  API_PRODUCTS_FIXTURE,
  API_SECRET_KEY,
  CREATE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  DEPLOY_BLOB_SHA256,
  DEPLOY_ID,
  DISTINCT_ID,
  FINALIZE_PAYWALL_DEPLOY_RESPONSE_FIXTURE,
  HarnessClient,
  INVALID_API_SECRET_KEY,
  ORGANIZATION_ID,
  PAYWALL_LOCATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE,
  PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE,
  PERSON_ENTITLEMENTS_FIXTURE,
  PERSON_ID,
  PERKS_LIST_FIXTURE,
  PRODUCT_PERKS_LIST_FIXTURE,
  PROJECTS_LIST_FIXTURE,
  PROJECT_FIXTURE,
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
      makeClient: (secretKey: string) => VoidhashNodeClient,
    ) => Promise<void>,
  ): Promise<void> => {
    const session = await harness.createSession(suiteName);
    const makeClient = (secretKey: string): VoidhashNodeClient =>
      createVoidhashSdk({
        baseUrl: handle.url,
        headers: { "x-harness-session": session.sessionId },
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
      expect(await sdk.schema.getSchema()).toEqual(SCHEMA_FIXTURE);
      expect(await sdk.products.listProducts()).toEqual(API_PRODUCTS_FIXTURE);

      expect(
        await sdk.persons.createPerson({
          payload: { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
        }),
      ).toEqual(API_PERSON_FIXTURE);

      expect(
        await sdk.persons.getPersonByDistinctId({ params: { distinctId: DISTINCT_ID } }),
      ).toEqual(API_PERSON_FIXTURE);

      expect(await sdk.persons.listPersons()).toEqual(API_PERSONS_LIST_FIXTURE);
      expect(await sdk.persons.getPersonById({ params: { personId: PERSON_ID } })).toEqual(
        API_PERSON_FIXTURE,
      );
      expect(
        await sdk.persons.getPersonEntitlements({ params: { personId: PERSON_ID } }),
      ).toEqual(PERSON_ENTITLEMENTS_FIXTURE);

      // Scripted failures must surface as errors, never as junk values.
      await expectRejection(
        sdk.persons.getPersonById({ params: { personId: "person_conformance_missing" } }),
        "Api/PersonNotFoundError",
      );

      expect(await sdk.schema.getSchemaVersion()).toEqual(SCHEMA_VERSION_FIXTURE);
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

      await expectRejection(sdk.products.listProducts(), "Api/ActionForbiddenError");
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
      expect(await sdk.projects.listProjects({ params: { organizationId: ORGANIZATION_ID } })).toEqual(
        PROJECTS_LIST_FIXTURE,
      );
    });
  });

  it("api/api-keys", async () => {
    await runSuite("api/api-keys", async (sdk) => {
      expect(
        await sdk.apiKeys.createSecretKey({
          payload: { name: "Conformance Secret Key", projectId: "proj_conformance_001" },
        }),
      ).toEqual(API_KEY_WITH_RAW_KEY_FIXTURE);
      expect(await sdk.apiKeys.listApiKeys()).toEqual([API_KEY_FIXTURE]);
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
      expect(await sdk.webhooks.listWebhookEndpoints()).toEqual([WEBHOOK_ENDPOINT_FIXTURE]);
      expect(
        await sdk.webhooks.getWebhookEndpoint({ params: { endpointId: WEBHOOK_ENDPOINT_ID } }),
      ).toEqual(WEBHOOK_ENDPOINT_FIXTURE);
      expect(
        await sdk.webhooks.updateWebhookEndpoint({
          params: { endpointId: WEBHOOK_ENDPOINT_ID },
          payload: {
            description: "Rotated",
            events: ["purchase.completed"],
            status: "disabled",
          },
        }),
      ).toEqual(WEBHOOK_ENDPOINT_DISABLED_FIXTURE);
      expect(
        await sdk.webhooks.rotateWebhookSecret({ params: { endpointId: WEBHOOK_ENDPOINT_ID } }),
      ).toEqual(WEBHOOK_ENDPOINT_DISABLED_FIXTURE);
      expect(
        await sdk.webhooks.testWebhookEndpoint({ params: { endpointId: WEBHOOK_ENDPOINT_ID } }),
      ).toEqual(WEBHOOK_DELIVERY_FIXTURE);
      expect(
        await sdk.webhooks.deleteWebhookEndpoint({ params: { endpointId: WEBHOOK_ENDPOINT_ID } }),
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
        sdk.webhooks.getWebhookEndpoint({ params: { endpointId: "wh_conformance_missing" } }),
        "Api/WebhookEndpointNotFoundError",
      );

      expect(await sdk.webhooks.listWebhookDeliveries()).toEqual([WEBHOOK_DELIVERY_FIXTURE]);
      expect(
        await sdk.webhooks.getWebhookDelivery({ params: { deliveryId: WEBHOOK_DELIVERY_ID } }),
      ).toEqual(WEBHOOK_DELIVERY_WITH_ATTEMPTS_FIXTURE);
      expect(
        await sdk.webhooks.retryWebhookDelivery({ params: { deliveryId: WEBHOOK_DELIVERY_ID } }),
      ).toEqual(WEBHOOK_DELIVERY_FIXTURE);
    });
  });

  it("api/catalog", async () => {
    await runSuite("api/catalog", async (sdk) => {
      expect(await sdk.perks.listPerks()).toEqual(PERKS_LIST_FIXTURE);
      expect(await sdk.paywallLocations.listPaywallLocations()).toEqual(
        PAYWALL_LOCATIONS_LIST_FIXTURE,
      );
      expect(
        await sdk.productPerks.listProductPerksByProductId({ params: { productId: "prod_monthly" } }),
      ).toEqual(PRODUCT_PERKS_LIST_FIXTURE);
      expect(await sdk.paymentProviderConfigurations.listPaymentProviderConfigurations()).toEqual(
        PAYMENT_PROVIDER_CONFIGURATIONS_LIST_FIXTURE,
      );
      expect(await sdk.paymentProviderProducts.listPaymentProviderProducts()).toEqual(
        PAYMENT_PROVIDER_PRODUCTS_LIST_FIXTURE,
      );
    });
  });

  it("api/notifications", async () => {
    await runSuite("api/notifications", async (sdk) => {
      expect(
        await sdk.notifications.sendNotification({
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
        }),
      ).toEqual(SEND_NOTIFICATION_RESPONSE_FIXTURE);
      await expectRejection(
        sdk.notifications.sendNotification({
          payload: {
            body: "Conformance push",
            distinctIds: [`missing-${DISTINCT_ID}`],
            title: "Conformance",
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
});
