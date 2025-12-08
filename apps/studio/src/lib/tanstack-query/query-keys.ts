const apiKeyKeys = {
  all: ['apiKeys'] as const,
  list: ({ projectId }: { projectId: string }) =>
    [...apiKeyKeys.all, 'list', { projectId }] as const,
  getApiKey: (apiKeyId: string) =>
    [...apiKeyKeys.all, 'getApiKey', { apiKeyId }] as const
};

const userKeys = {
  all: ['users'] as const,
  getUser: () => [...userKeys.all, 'getUser'] as const
};

const organizationKeys = {
  all: ['organizations'] as const,
  getOrganization: (organizationId: string) =>
    [...organizationKeys.all, 'getOrganization', { organizationId }] as const
};

const customerKeys = {
  all: ['customers'] as const,
  list: (projectId: string) =>
    [...customerKeys.all, 'list', { projectId }] as const,
  getCustomer: (customerId: string) =>
    [...customerKeys.all, 'getCustomer', { customerId }] as const,
  getCustomerByAppUserId: (projectId: string, appUserId: string) =>
    [
      ...customerKeys.all,
      'getCustomerByAppUserId',
      { projectId, appUserId }
    ] as const
};

const perkKeys = {
  all: ['perks'] as const,
  list: (options: { projectId: string }) =>
    [...perkKeys.all, 'list', options] as const
};

const productKeys = {
  all: ['products'] as const,
  list: (options: { projectId: string }) =>
    [...productKeys.all, 'list', options] as const,
  getProduct: (options: { productId: string }) =>
    [...productKeys.all, 'getProduct', options] as const
};

const projectKeys = {
  all: ['projects'] as const,
  list: (options: { organizationId: string }) =>
    [...projectKeys.all, 'list', options] as const
};

const productPerkKeys = {
  all: ['productPerks'] as const,
  listByProduct: (options: { productId: string }) =>
    [...productPerkKeys.all, 'listByProduct', options] as const
};

const paymentProviderConfigurationKeys = {
  all: ['paymentProviderConfigurations'] as const,
  list: (options: { projectId: string }) =>
    [...paymentProviderConfigurationKeys.all, 'list', options] as const,
  getPaymentProviderConfiguration: (options: { id: string }) =>
    [
      ...paymentProviderConfigurationKeys.all,
      'getPaymentProviderConfiguration',
      options
    ] as const
};

const paymentProviderProductKeys = {
  all: ['paymentProviderProducts'] as const,
  listByProduct: (options: { productId: string }) =>
    [...paymentProviderProductKeys.all, 'listByProduct', options] as const
};

export const queryKeys = {
  invalidateAll: () => [],
  apiKey: apiKeyKeys,
  user: userKeys,
  organization: organizationKeys,
  customer: customerKeys,
  perk: perkKeys,
  product: productKeys,
  project: projectKeys,
  productPerk: productPerkKeys,
  paymentProviderConfiguration: paymentProviderConfigurationKeys,
  paymentProviderProduct: paymentProviderProductKeys
};
