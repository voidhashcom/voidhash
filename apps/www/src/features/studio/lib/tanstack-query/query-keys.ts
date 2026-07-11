const apiKeyKeys = {
  all: ["apiKeys"] as const,
  getApiKey: (apiKeyId: string) => [...apiKeyKeys.all, "getApiKey", { apiKeyId }] as const,
  list: ({ projectId }: { projectId: string }) =>
    [...apiKeyKeys.all, "list", { projectId }] as const,
};

const userKeys = {
  all: ["users"] as const,
  getUser: () => [...userKeys.all, "getUser"] as const,
};

const organizationKeys = {
  all: ["organizations"] as const,
  getOrganization: (organizationId: string) =>
    [...organizationKeys.all, "getOrganization", { organizationId }] as const,
};

const personKeys = {
  all: ["persons"] as const,
  getPersonByDistinctId: (projectId: string, distinctId: string) =>
    [...personKeys.all, "getPersonByDistinctId", { distinctId, projectId }] as const,
  list: (projectId: string) => [...personKeys.all, "list", { projectId }] as const,
};

const perkKeys = {
  all: ["perks"] as const,
  list: (options: { projectId: string }) => [...perkKeys.all, "list", options] as const,
};

const productKeys = {
  all: ["products"] as const,
  getProduct: (options: { productId: string }) =>
    [...productKeys.all, "getProduct", options] as const,
  list: (options: { projectId: string }) => [...productKeys.all, "list", options] as const,
};

const projectKeys = {
  all: ["projects"] as const,
  list: (options: { organizationId: string }) => [...projectKeys.all, "list", options] as const,
};

const productPerkKeys = {
  all: ["productPerks"] as const,
  listByProduct: (options: { productId: string }) =>
    [...productPerkKeys.all, "listByProduct", options] as const,
};

const paymentProviderConfigurationKeys = {
  all: ["paymentProviderConfigurations"] as const,
  getPaymentProviderConfiguration: (options: { id: string }) =>
    [...paymentProviderConfigurationKeys.all, "getPaymentProviderConfiguration", options] as const,
  list: (options: { projectId: string }) =>
    [...paymentProviderConfigurationKeys.all, "list", options] as const,
};

const pushNotificationConfigurationKeys = {
  all: ["pushNotificationConfigurations"] as const,
  getPushNotificationConfiguration: (options: { id: string }) =>
    [...pushNotificationConfigurationKeys.all, "getPushNotificationConfiguration", options] as const,
  list: (options: { projectId: string }) =>
    [...pushNotificationConfigurationKeys.all, "list", options] as const,
};

const pushNotificationSendKeys = {
  all: ["pushNotificationSends"] as const,
  deliveries: (options: { projectId: string; sendId: string }) =>
    [...pushNotificationSendKeys.all, "deliveries", options] as const,
  list: (options: { projectId: string; limit: number }) =>
    [...pushNotificationSendKeys.all, "list", options] as const,
};

const paymentProviderProductKeys = {
  all: ["paymentProviderProducts"] as const,
  listByProduct: (options: { productId: string }) =>
    [...paymentProviderProductKeys.all, "listByProduct", options] as const,
};

const paywallKeys = {
  all: ["paywalls"] as const,
  draft: (options: { paywallId: string }) => [...paywallKeys.all, "draft", options] as const,
  list: (options: { projectId: string; includeArchived?: boolean }) =>
    [...paywallKeys.all, "list", options] as const,
};

const paywallComponentKeys = {
  all: ["paywallComponents"] as const,
  list: (options: { projectId: string }) => [...paywallComponentKeys.all, "list", options] as const,
  versions: (options: {
    projectId: string;
    refs: ReadonlyArray<{ slug: string; version: number }>;
  }) => [...paywallComponentKeys.all, "versions", options] as const,
};

const paywallDeployKeys = {
  all: ["paywallDeploys"] as const,
  list: (options: { projectId: string }) => [...paywallDeployKeys.all, "list", options] as const,
};

const paywallLocationKeys = {
  all: ["paywallLocations"] as const,
  list: (options: { projectId: string; includeArchived?: boolean }) =>
    [...paywallLocationKeys.all, "list", options] as const,
  showings: (options: { locationId: string }) =>
    [...paywallLocationKeys.all, "showings", options] as const,
};

const paywallAssetKeys = {
  all: ["paywallAssets"] as const,
  list: (options: { organizationId: string }) =>
    [...paywallAssetKeys.all, "list", options] as const,
};


const aiChatKeys = {
  all: ["aiChats"] as const,
  list: (options: {
    organizationId: string;
    projectId: string;
    surface: string;
    paywallId?: string;
  }) => [...aiChatKeys.all, "list", options] as const,
  get: (chatId: string) => [...aiChatKeys.all, "get", { chatId }] as const,
};

const webhookKeys = {
  all: ["webhooks"] as const,
  deliveries: (options: { projectId: string; endpointId?: string }) =>
    [...webhookKeys.all, "deliveries", options] as const,
  getDelivery: (deliveryId: string) => [...webhookKeys.all, "getDelivery", { deliveryId }] as const,
  getEndpoint: (endpointId: string) => [...webhookKeys.all, "getEndpoint", { endpointId }] as const,
  list: (options: { projectId: string }) => [...webhookKeys.all, "list", options] as const,
};

const featureFlagKeys = {
  all: ["featureFlags"] as const,
  getFlag: (id: string) => [...featureFlagKeys.all, "getFlag", { id }] as const,
  list: (options: { projectId: string }) => [...featureFlagKeys.all, "list", options] as const,
  overridesByPerson: (options: {
    projectId: string;
    identityType: number;
    identityValue: string;
  }) => [...featureFlagKeys.all, "overridesByPerson", options] as const,
};

const experimentKeys = {
  all: ["experiments"] as const,
  getExperiment: (id: string) => [...experimentKeys.all, "getExperiment", { id }] as const,
  list: (options: { projectId: string }) => [...experimentKeys.all, "list", options] as const,
};

const analyticsKeys = {
  all: ["analytics"] as const,
  query: (options: unknown) => [...analyticsKeys.all, "query", options] as const,
  recentEvents: (options: { projectId: string; limit: number }) =>
    [...analyticsKeys.all, "recentEvents", options] as const,
};

export const queryKeys = {
  analytics: analyticsKeys,
  apiKey: apiKeyKeys,
  person: personKeys,
  aiChat: aiChatKeys,
  experiment: experimentKeys,
  featureFlag: featureFlagKeys,
  invalidateAll: () => [],
  organization: organizationKeys,
  paymentProviderConfiguration: paymentProviderConfigurationKeys,
  paymentProviderProduct: paymentProviderProductKeys,
  pushNotificationConfiguration: pushNotificationConfigurationKeys,
  pushNotificationSend: pushNotificationSendKeys,
  paywall: paywallKeys,
  paywallAsset: paywallAssetKeys,
  paywallComponent: paywallComponentKeys,
  paywallDeploy: paywallDeployKeys,
  paywallLocation: paywallLocationKeys,
  perk: perkKeys,
  product: productKeys,
  productPerk: productPerkKeys,
  project: projectKeys,
  user: userKeys,
  webhook: webhookKeys,
};
