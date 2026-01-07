const apiKeyKeys = {
  all: ["apiKeys"] as const,
  getApiKey: (apiKeyId: string) =>
    [...apiKeyKeys.all, "getApiKey", { apiKeyId }] as const,
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

const customerKeys = {
  all: ["customers"] as const,
  getCustomer: (customerId: string) =>
    [...customerKeys.all, "getCustomer", { customerId }] as const,
  getCustomerByAppUserId: (projectId: string, appUserId: string) =>
    [
      ...customerKeys.all,
      "getCustomerByAppUserId",
      { appUserId, projectId },
    ] as const,
  list: (projectId: string) =>
    [...customerKeys.all, "list", { projectId }] as const,
};

const perkKeys = {
  all: ["perks"] as const,
  list: (options: { projectId: string }) =>
    [...perkKeys.all, "list", options] as const,
};

const productKeys = {
  all: ["products"] as const,
  getProduct: (options: { productId: string }) =>
    [...productKeys.all, "getProduct", options] as const,
  list: (options: { projectId: string }) =>
    [...productKeys.all, "list", options] as const,
};

const projectKeys = {
  all: ["projects"] as const,
  list: (options: { organizationId: string }) =>
    [...projectKeys.all, "list", options] as const,
};

const productPerkKeys = {
  all: ["productPerks"] as const,
  listByProduct: (options: { productId: string }) =>
    [...productPerkKeys.all, "listByProduct", options] as const,
};

const paymentProviderConfigurationKeys = {
  all: ["paymentProviderConfigurations"] as const,
  getPaymentProviderConfiguration: (options: { id: string }) =>
    [
      ...paymentProviderConfigurationKeys.all,
      "getPaymentProviderConfiguration",
      options,
    ] as const,
  list: (options: { projectId: string }) =>
    [...paymentProviderConfigurationKeys.all, "list", options] as const,
};

const paymentProviderProductKeys = {
  all: ["paymentProviderProducts"] as const,
  listByProduct: (options: { productId: string }) =>
    [...paymentProviderProductKeys.all, "listByProduct", options] as const,
};

const paywallKeys = {
  all: ["paywalls"] as const,
  list: (options: { projectId: string }) =>
    [...paywallKeys.all, "list", options] as const,
};

const billingKeys = {
  all: ["billing"] as const,
  getOrganizationBilling: (organizationId: string) =>
    [...billingKeys.all, "getOrganizationBilling", { organizationId }] as const,
  getUsageSummaries: (organizationId: string) =>
    [...billingKeys.all, "getUsageSummaries", { organizationId }] as const,
};

export const queryKeys = {
  apiKey: apiKeyKeys,
  billing: billingKeys,
  customer: customerKeys,
  invalidateAll: () => [],
  organization: organizationKeys,
  paymentProviderConfiguration: paymentProviderConfigurationKeys,
  paymentProviderProduct: paymentProviderProductKeys,
  paywall: paywallKeys,
  perk: perkKeys,
  product: productKeys,
  productPerk: productPerkKeys,
  project: projectKeys,
  user: userKeys,
};
