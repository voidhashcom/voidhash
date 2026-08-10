import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

import { BackendRpcGroups as RpcGroups } from "../BackendRpcGroups.ts";

import type { SmokeIds } from "./smoke-ids.ts";

export type RpcSmokeRole = "admin" | "user";

export interface RpcSmokeContext {
  readonly ids: SmokeIds;
  readonly runId: string;
  readonly webhookTargetUrl?: string;
  apiKeyId?: string;
  extraOrganizationId?: string;
  extraProjectId?: string;
  featureFlagId?: string;
  featureFlagOverrideId?: string;
  featureFlagTargetId?: string;
  paymentProviderConfigurationId?: string;
  paywallId?: string;
  paywallLocationId?: string;
  paywallReleaseId?: string;
  perkId?: string;
  personDistinctId?: string;
  personId?: string;
  productId?: string;
  productPerkId?: string;
  userApiKeyId?: string;
  webhookDeliveryId?: string;
  webhookEndpointId?: string;
}

export interface RpcSmokeCase {
  readonly tag: string;
  readonly role: RpcSmokeRole;
  readonly payload?: (context: RpcSmokeContext) => unknown;
  readonly expected?: { readonly errorTag: string } | { readonly success: true };
  readonly afterSuccess?: (context: RpcSmokeContext, result: unknown) => void;
}

const success = constant({ success: true });
const error = (errorTag: string) => constant({ errorTag });

/**
 * Aborts the smoke run with a defect. The manifest's assertion helpers are
 * plain synchronous callbacks invoked by the runner, so a broken expectation is
 * raised as an Effect defect rather than modelled as a recoverable failure.
 */
const dieWith = (message: string): never => Effect.runSync(Effect.die(new Error(message)));

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || Array.isArray(value)) return false;
  return typeof value === "object";
};

const expectObject = (result: unknown, tag: string): Record<string, unknown> => {
  if (!isRecord(result)) {
    return dieWith(`${tag} returned a non-object result`);
  }
  return result;
};

const expectStringField = (result: unknown, tag: string, field: string): string => {
  const value = expectObject(result, tag)[field];
  if (typeof value !== "string" || value.length === 0) {
    return dieWith(`${tag} did not return a string ${field}`);
  }
  return value;
};

const expectArray = (result: unknown, tag: string): ReadonlyArray<unknown> => {
  if (!Array.isArray(result)) {
    return dieWith(`${tag} returned a non-array result`);
  }
  return result;
};

/**
 * Builds the mutable smoke-test context shared by sequential RPC cases.
 */
export const makeRpcSmokeContext = (
  runId: string,
  ids: SmokeIds,
  webhookTargetUrl?: string,
): RpcSmokeContext => ({
  ids,
  apiKeyId: ids.apiKeyId,
  personDistinctId: `person-${runId}`,
  runId,
  webhookTargetUrl,
});

export const rpcSmokeCases = [
  {
    expected: success,
    payload: ({ ids }) => ({ limit: 5, projectId: ids.projectId }),
    role: "admin",
    tag: "ListRecentAnalyticsEvents",
  },
  {
    expected: success,
    payload: ({ ids }) => ({
      queries: [
        {
          context: { organizationId: ids.organizationId },
          insightId: "builtin/person_count",
          key: "person-count",
          timeRange: { preset: "last_7d" },
        },
      ],
    }),
    role: "admin",
    tag: "QueryAnalyticsInsights",
  },
  {
    expected: success,
    role: "user",
    tag: "CurrentUser",
  },
  {
    afterSuccess: (context, result) => {
      context.extraOrganizationId = expectStringField(result, "CreateOrganization", "id");
    },
    expected: success,
    payload: ({ runId }) => ({ name: `Smoke Extra Org ${runId}` }),
    role: "admin",
    tag: "CreateOrganization",
  },
  {
    expected: success,
    payload: ({ extraOrganizationId, runId }) => ({
      name: `Smoke Extra Org Updated ${runId}`,
      organizationId: extraOrganizationId,
    }),
    role: "admin",
    tag: "UpdateOrganization",
  },
  {
    expected: success,
    payload: ({ extraOrganizationId }) => ({ organizationId: extraOrganizationId }),
    role: "admin",
    tag: "DeleteOrganization",
  },
  {
    expected: success,
    payload: ({ ids, runId }) => ({
      name: `Smoke Extra Project ${runId}`,
      organizationId: ids.organizationId,
    }),
    role: "admin",
    tag: "CreateProject",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ organizationId: ids.organizationId }),
    role: "admin",
    tag: "ListProjects",
  },
  {
    expected: success,
    payload: ({ ids, runId }) => ({
      id: ids.projectId,
      name: `Smoke Extra Project Updated ${runId}`,
    }),
    role: "admin",
    tag: "UpdateProject",
  },
  {
    expected: error("Rpc/ProjectNotFoundError"),
    payload: ({ runId }) => ({ id: `missing_project_${runId}` }),
    role: "admin",
    tag: "DeleteProject",
  },
  {
    afterSuccess: (context, result) => {
      context.apiKeyId = expectStringField(result, "CreateSecretKey", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({ name: `Smoke secret ${runId}`, projectId: ids.projectId }),
    role: "admin",
    tag: "CreateSecretKey",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListApiKeys",
  },
  {
    expected: success,
    payload: ({ apiKeyId }) => ({ apiKeyId }),
    role: "admin",
    tag: "GetApiKeyById",
  },
  {
    expected: success,
    payload: ({ apiKeyId }) => ({ apiKeyId }),
    role: "admin",
    tag: "RotateSecretKey",
  },
  {
    expected: success,
    payload: ({ apiKeyId }) => ({ apiKeyId }),
    role: "admin",
    tag: "DeleteApiKey",
  },
  {
    afterSuccess: (context, result) => {
      context.userApiKeyId = expectStringField(result, "CreateUserApiKey", "id");
    },
    expected: success,
    payload: ({ runId }) => ({ name: `Smoke user key ${runId}`, prefix: "smk" }),
    role: "admin",
    tag: "CreateUserApiKey",
  },
  {
    expected: success,
    payload: () => ({}),
    role: "admin",
    tag: "ListUserApiKeys",
  },
  {
    expected: success,
    payload: ({ userApiKeyId }) => ({ userApiKeyId }),
    role: "admin",
    tag: "RevokeUserApiKey",
  },
  {
    afterSuccess: (context, result) => {
      context.personId = expectStringField(result, "CreatePerson", "personId");
    },
    expected: success,
    payload: ({ ids, personDistinctId, runId }) => ({
      distinctId: personDistinctId,
      email: `person-${runId}@example.test`,
      name: "Smoke Person",
      projectId: ids.projectId,
    }),
    role: "admin",
    tag: "CreatePerson",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListPersons",
  },
  {
    expected: success,
    payload: ({ personId }) => ({ personId }),
    role: "admin",
    tag: "GetPersonById",
  },
  {
    expected: success,
    payload: ({ ids, personDistinctId }) => ({
      distinctId: personDistinctId,
      projectId: ids.projectId,
    }),
    role: "admin",
    tag: "GetPersonByDistinctId",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ includeArchived: true, projectId: ids.projectId }),
    role: "admin",
    tag: "ListFeatureFlags",
  },
  {
    afterSuccess: (context, result) => {
      context.featureFlagId = expectStringField(result, "CreateFeatureFlag", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({
      description: "Smoke flag",
      projectId: ids.projectId,
      slug: `smoke-flag-${runId}`,
      type: "json",
      variants: [],
    }),
    role: "admin",
    tag: "CreateFeatureFlag",
  },
  {
    expected: success,
    payload: ({ featureFlagId }) => ({ id: featureFlagId }),
    role: "admin",
    tag: "GetFeatureFlag",
  },
  {
    expected: success,
    payload: ({ featureFlagId, runId }) => ({
      enabled: true,
      id: featureFlagId,
      rolloutBps: 5000,
      slug: `smoke-flag-updated-${runId}`,
    }),
    role: "admin",
    tag: "UpdateFeatureFlag",
  },
  {
    expected: success,
    payload: ({ featureFlagId }) => ({
      featureFlagId,
      variants: [
        {
          value: { kind: "control" },
        },
      ],
    }),
    role: "admin",
    tag: "UpdateFeatureFlagVariants",
  },
  {
    afterSuccess: (context, result) => {
      context.featureFlagOverrideId = expectStringField(result, "UpsertFeatureFlagOverride", "id");
    },
    expected: success,
    payload: ({ featureFlagId, runId }) => ({
      featureFlagId,
      forcedEnabled: true,
      identityType: 2,
      identityValue: `distinct-${runId}`,
      note: "smoke",
    }),
    role: "admin",
    tag: "UpsertFeatureFlagOverride",
  },
  {
    expected: success,
    payload: ({ featureFlagId }) => ({ featureFlagId }),
    role: "admin",
    tag: "ListFeatureFlagOverridesByFlag",
  },
  {
    expected: success,
    payload: ({ ids, runId }) => ({
      identityType: 2,
      identityValue: `distinct-${runId}`,
      projectId: ids.projectId,
    }),
    role: "admin",
    tag: "ListFeatureFlagOverridesByPerson",
  },
  {
    expected: success,
    payload: ({ featureFlagOverrideId }) => ({ id: featureFlagOverrideId }),
    role: "admin",
    tag: "ArchiveFeatureFlagOverride",
  },
  {
    afterSuccess: (context, result) => {
      context.featureFlagTargetId = expectStringField(result, "UpsertFeatureFlagTarget", "id");
    },
    expected: success,
    payload: ({ featureFlagId, runId }) => ({
      featureFlagId,
      identityType: 2,
      identityValue: `distinct-${runId}`,
      listType: 1,
    }),
    role: "admin",
    tag: "UpsertFeatureFlagTarget",
  },
  {
    expected: success,
    payload: ({ featureFlagTargetId }) => ({ id: featureFlagTargetId }),
    role: "admin",
    tag: "ArchiveFeatureFlagTarget",
  },
  {
    expected: success,
    payload: ({ featureFlagId }) => ({ id: featureFlagId }),
    role: "admin",
    tag: "ArchiveFeatureFlag",
  },
  {
    expected: success,
    payload: ({ featureFlagId }) => ({ id: featureFlagId }),
    role: "admin",
    tag: "RestoreFeatureFlag",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListProducts",
  },
  {
    afterSuccess: (context, result) => {
      context.productId = expectStringField(result, "CreateProduct", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({
      name: "Smoke Product",
      projectId: ids.projectId,
      slug: `smoke-product-${runId}`,
    }),
    role: "admin",
    tag: "CreateProduct",
  },
  {
    expected: success,
    payload: ({ productId }) => ({ id: productId }),
    role: "admin",
    tag: "GetProduct",
  },
  {
    expected: success,
    payload: ({ productId, runId }) => ({
      id: productId,
      name: `Smoke Product ${runId}`,
      slug: `smoke-product-updated-${runId}`,
    }),
    role: "admin",
    tag: "UpdateProduct",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListPerks",
  },
  {
    afterSuccess: (context, result) => {
      context.perkId = expectStringField(result, "CreatePerk", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({
      name: "Smoke Perk",
      projectId: ids.projectId,
      slug: `smoke-perk-${runId}`,
    }),
    role: "admin",
    tag: "CreatePerk",
  },
  {
    expected: success,
    payload: ({ perkId, productId }) => ({ perkId, productId }),
    role: "admin",
    tag: "CreateProductPerk",
  },
  {
    afterSuccess: (context, result) => {
      const productPerk = expectArray(result, "ListProductPerksByProductId")[0];
      context.productPerkId = expectStringField(productPerk, "ListProductPerksByProductId", "id");
    },
    expected: success,
    payload: ({ productId }) => ({ productId }),
    role: "admin",
    tag: "ListProductPerksByProductId",
  },
  {
    expected: success,
    payload: ({ productPerkId }) => ({ id: productPerkId }),
    role: "admin",
    tag: "DeleteProductPerk",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListPaymentProviderConfigurations",
  },
  {
    afterSuccess: (context, result) => {
      context.paymentProviderConfigurationId = expectStringField(
        result,
        "CreatePaymentProviderConfiguration",
        "id",
      );
    },
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId, providerId: "stripe" }),
    role: "admin",
    tag: "CreatePaymentProviderConfiguration",
  },
  {
    expected: success,
    payload: ({ paymentProviderConfigurationId }) => ({ id: paymentProviderConfigurationId }),
    role: "admin",
    tag: "GetPaymentProviderConfiguration",
  },
  {
    expected: error("Rpc/PaymentProviderConfigurationValidationError"),
    payload: ({ paymentProviderConfigurationId }) => ({
      configuration: {},
      enabled: true,
      id: paymentProviderConfigurationId,
      name: "Stripe Smoke",
    }),
    role: "admin",
    tag: "UpdatePaymentProviderConfiguration",
  },
  {
    expected: success,
    payload: ({ productId }) => ({ productId }),
    role: "admin",
    tag: "ListProviderProductsByProductId",
  },
  {
    expected: error("Rpc/PaymentProviderProductValidationError"),
    payload: ({ paymentProviderConfigurationId, productId }) => ({
      configuration: {},
      paymentProviderConfigurationId,
      productId,
    }),
    role: "admin",
    tag: "CreatePaymentProviderProduct",
  },
  {
    expected: error("Rpc/PaymentProviderProductNotFoundError"),
    payload: ({ runId }) => ({ configuration: {}, id: `missing-provider-product-${runId}` }),
    role: "admin",
    tag: "UpdatePaymentProviderProduct",
  },
  {
    expected: error("Rpc/PaymentProviderProductValidationError"),
    payload: ({ runId }) => ({ id: `missing-provider-product-${runId}` }),
    role: "admin",
    tag: "DeletePaymentProviderProduct",
  },
  {
    expected: success,
    payload: ({ paymentProviderConfigurationId, productId, runId }) => ({
      paymentProviderConfigurationId,
      productId,
      providerProductKey: `missing-provider-key-${runId}`,
    }),
    role: "admin",
    tag: "SetActivePaymentProviderProduct",
  },
  {
    expected: success,
    payload: ({ paymentProviderConfigurationId }) => ({ paymentProviderConfigurationId }),
    role: "admin",
    tag: "DeletePaymentProviderConfiguration",
  },
  {
    expected: success,
    payload: ({ perkId }) => ({ perkId }),
    role: "admin",
    tag: "DeletePerk",
  },
  {
    expected: success,
    payload: ({ productId }) => ({ id: productId }),
    role: "admin",
    tag: "DeleteProduct",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListPaywalls",
  },
  {
    afterSuccess: (context, result) => {
      context.paywallId = expectStringField(result, "CreatePaywall", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({
      name: "Smoke Paywall",
      projectId: ids.projectId,
      slug: `smoke-paywall-${runId}`,
    }),
    role: "admin",
    tag: "CreatePaywall",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ includeArchived: true, projectId: ids.projectId }),
    role: "admin",
    tag: "ListPaywallLocations",
  },
  {
    afterSuccess: (context, result) => {
      context.paywallLocationId = expectStringField(result, "CreatePaywallLocation", "id");
    },
    expected: success,
    payload: ({ ids, runId }) => ({
      description: "Smoke location",
      name: "Smoke Location",
      projectId: ids.projectId,
      slug: `smoke-location-${runId}`,
    }),
    role: "admin",
    tag: "CreatePaywallLocation",
  },
  {
    expected: success,
    payload: ({ paywallLocationId, runId }) => ({
      description: "Smoke location updated",
      locationId: paywallLocationId,
      name: `Smoke Location ${runId}`,
    }),
    role: "admin",
    tag: "UpdatePaywallLocation",
  },
  {
    expected: error("Rpc/PaywallLocationShowingValidationError"),
    payload: ({ paywallId, paywallLocationId }) => ({
      locationId: paywallLocationId,
      paywallId,
      type: "paywall_release",
    }),
    role: "admin",
    tag: "AssignPaywallLocationShowing",
  },
  {
    afterSuccess: (_context, result) => {
      expectStringField(result, "RequestPaywallEditToken", "token");
      expectStringField(result, "RequestPaywallEditToken", "url");
      const expiresAt = expectObject(result, "RequestPaywallEditToken").expiresAt;
      if (!(expiresAt instanceof Date)) {
        return dieWith("RequestPaywallEditToken did not return a Date expiresAt");
      }
    },
    expected: success,
    payload: ({ paywallId }) => ({ paywallId }),
    role: "admin",
    tag: "RequestPaywallEditToken",
  },
  {
    afterSuccess: (context, result) => {
      context.paywallReleaseId = expectStringField(result, "CreatePaywallRelease", "releaseId");
      expectStringField(result, "CreatePaywallRelease", "draftUrl");
    },
    expected: success,
    payload: ({ paywallId }) => ({ paywallId }),
    role: "admin",
    tag: "CreatePaywallRelease",
  },
  {
    afterSuccess: (context, result) => {
      const releaseId = expectStringField(result, "GetPaywallDraftRelease", "releaseId");
      if (releaseId !== context.paywallReleaseId) {
        return dieWith("GetPaywallDraftRelease returned a different release");
      }
    },
    expected: success,
    payload: ({ paywallId }) => ({ paywallId }),
    role: "admin",
    tag: "GetPaywallDraftRelease",
  },
  {
    afterSuccess: (_context, result) => {
      expectStringField(result, "PublishPaywallRelease", "releaseId");
      expectStringField(result, "PublishPaywallRelease", "htmlUrl");
    },
    expected: success,
    payload: ({ paywallReleaseId }) => ({ releaseId: paywallReleaseId }),
    role: "admin",
    tag: "PublishPaywallRelease",
  },
  {
    expected: error("Rpc/ReleaseNotFoundError"),
    payload: ({ runId }) => ({ releaseId: `missing-release-${runId}` }),
    role: "admin",
    tag: "PublishPaywallRelease",
  },
  {
    expected: success,
    payload: ({ paywallId, paywallLocationId }) => ({
      locationId: paywallLocationId,
      paywallId,
      type: "paywall_release",
    }),
    role: "admin",
    tag: "AssignPaywallLocationShowing",
  },
  {
    expected: success,
    payload: ({ paywallLocationId }) => ({ locationId: paywallLocationId }),
    role: "admin",
    tag: "ClearPaywallLocationShowing",
  },
  {
    expected: success,
    payload: ({ paywallLocationId }) => ({ locationId: paywallLocationId }),
    role: "admin",
    tag: "ListPaywallLocationShowings",
  },
  {
    expected: success,
    payload: ({ paywallLocationId }) => ({ locationId: paywallLocationId }),
    role: "admin",
    tag: "ArchivePaywallLocation",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListPaywallDeploys",
  },
  {
    expected: error("Rpc/ReleaseNotFoundError"),
    payload: ({ runId }) => ({ releaseId: `missing-release-${runId}` }),
    role: "admin",
    tag: "SetActivePaywallRelease",
  },
  {
    expected: success,
    payload: ({ paywallId }) => ({ paywallId }),
    role: "admin",
    tag: "DeletePaywall",
  },
  {
    expected: success,
    payload: ({ ids }) => ({ projectId: ids.projectId }),
    role: "admin",
    tag: "ListWebhookEndpoints",
  },
  {
    afterSuccess: (context, result) => {
      context.webhookEndpointId = expectStringField(result, "CreateWebhookEndpoint", "id");
    },
    expected: success,
    payload: ({ ids, runId, webhookTargetUrl }) => ({
      description: "Smoke webhook endpoint",
      events: ["person.created"],
      name: `Smoke Webhook ${runId}`,
      projectId: ids.projectId,
      url: webhookTargetUrl,
    }),
    role: "admin",
    tag: "CreateWebhookEndpoint",
  },
  {
    expected: success,
    payload: ({ webhookEndpointId }) => ({ endpointId: webhookEndpointId }),
    role: "admin",
    tag: "GetWebhookEndpoint",
  },
  {
    expected: success,
    payload: ({ webhookEndpointId, runId }) => ({
      description: "Smoke webhook endpoint updated",
      endpointId: webhookEndpointId,
      events: ["person.created"],
      name: `Smoke Webhook Updated ${runId}`,
      status: "disabled",
    }),
    role: "admin",
    tag: "UpdateWebhookEndpoint",
  },
  {
    expected: success,
    payload: ({ webhookEndpointId }) => ({ endpointId: webhookEndpointId }),
    role: "admin",
    tag: "RotateWebhookSecret",
  },
  {
    afterSuccess: (context, result) => {
      context.webhookDeliveryId = expectStringField(result, "TestWebhookEndpoint", "id");
    },
    expected: success,
    payload: ({ webhookEndpointId }) => ({ endpointId: webhookEndpointId }),
    role: "admin",
    tag: "TestWebhookEndpoint",
  },
  {
    expected: success,
    payload: ({ ids, webhookEndpointId }) => ({
      endpointId: webhookEndpointId,
      projectId: ids.projectId,
    }),
    role: "admin",
    tag: "ListWebhookDeliveries",
  },
  {
    expected: success,
    payload: ({ webhookDeliveryId }) => ({ deliveryId: webhookDeliveryId }),
    role: "admin",
    tag: "GetWebhookDelivery",
  },
  {
    expected: error("Rpc/WebhookValidationError"),
    payload: ({ webhookDeliveryId }) => ({ deliveryId: webhookDeliveryId }),
    role: "admin",
    tag: "RetryWebhookDelivery",
  },
  {
    expected: success,
    payload: ({ webhookEndpointId }) => ({ endpointId: webhookEndpointId }),
    role: "admin",
    tag: "DeleteWebhookEndpoint",
  },
] satisfies ReadonlyArray<RpcSmokeCase>;

/** Existing RPC smoke coverage debt; entries may only be removed as cases are added. */
const knownMissingRpcSmokeTags = new Set([
  "ListAgentSessions",
  "GetAgentSession",
  "DeleteAgentSession",
  "RevertAgentEditSession",
  "UploadAgentAttachment",
  "ListExperiments",
  "GetExperiment",
  "CreateExperiment",
  "SaveExperimentSetup",
  "StartExperiment",
  "PauseExperiment",
  "ConcludeExperiment",
  "ArchiveExperiment",
  "RestoreExperiment",
  "GetExperimentResults",
  "SubmitFeedback",
  "SetOrganizationAvatar",
  "RemoveOrganizationAvatar",
  "ListPushNotificationConfigurations",
  "GetPushNotificationConfiguration",
  "CreatePushNotificationConfiguration",
  "UpdatePushNotificationConfiguration",
  "DeletePushNotificationConfiguration",
  "ListPushNotificationSends",
  "GetPushNotificationSendDeliveries",
  "UploadPaywallAsset",
  "ListPaywallAssets",
  "RenamePaywallAsset",
  "DeletePaywallAsset",
  "ListPaywallComponents",
  "GetPaywallComponentVersions",
  "SetProjectAvatar",
  "RemoveProjectAvatar",
  "RenamePaywall",
  "ArchivePaywall",
  "RestorePaywall",
  "ListWorkspacePaywalls",
  "ReadPaywallDocument",
  "RecordComponentManifest",
  "SetUserAvatar",
  "RemoveUserAvatar",
]);

/**
 * Verifies the smoke manifest does not regress beyond its explicit debt baseline.
 */
export const assertRpcSmokeManifestCoverage = () => {
  const rpcTags = new Set<string>(RpcGroups.requests.keys());
  const manifestTags = new Set<string>(rpcSmokeCases.map((rpcCase) => rpcCase.tag));
  const missing = [...rpcTags].filter((tag) => !manifestTags.has(tag));
  const unexpectedMissing = missing.filter((tag) => !knownMissingRpcSmokeTags.has(tag));
  const resolvedBaseline = [...knownMissingRpcSmokeTags].filter((tag) => !missing.includes(tag));
  const stale = [...manifestTags].filter((tag) => !rpcTags.has(tag));

  const problems: string[] = [];
  if (unexpectedMissing.length) {
    problems.push(`Unexpected missing smoke RPC cases: ${unexpectedMissing.join(", ")}`);
  }
  if (resolvedBaseline.length) {
    problems.push(`Resolved smoke baseline entries must be removed: ${resolvedBaseline.join(", ")}`);
  }
  if (stale.length) {
    problems.push(`Stale smoke RPC cases: ${stale.join(", ")}`);
  }
  if (problems.length) {
    return dieWith(problems.join("\n"));
  }
};
