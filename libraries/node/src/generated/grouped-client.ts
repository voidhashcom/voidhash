import type { VoidhashCoreClient } from "@voidhash/generated-clients";

export const groupCoreClient = (client: VoidhashCoreClient) => ({
  apiKeys: {
    createSecretKey: (request: { payload: Parameters<VoidhashCoreClient["apiKeysCreateSecretKey"]>[0] }) => client.apiKeysCreateSecretKey(request.payload),
    deleteApiKey: (request: { params: { readonly "apiKeyId": string } }) => client.apiKeysDeleteApiKey(request.params["apiKeyId"]),
    getApiKeyById: (request: { params: { readonly "apiKeyId": string } }) => client.apiKeysGetApiKeyById(request.params["apiKeyId"]),
    listApiKeys: () => client.apiKeysListApiKeys(),
    rotateSecretKey: (request: { params: { readonly "apiKeyId": string } }) => client.apiKeysRotateSecretKey(request.params["apiKeyId"]),
  },
  auth: {
    session: () => client.authSession(),
  },
  changesets: {
    deployChangeset: (request: { payload: Parameters<VoidhashCoreClient["changesetsDeployChangeset"]>[0] }) => client.changesetsDeployChangeset(request.payload),
  },
  customers: {
    byDistinctId: (request: { params: { readonly "distinctId": string } }) => client.customersByDistinctId(request.params["distinctId"]),
    createCustomer: (request: { payload: Parameters<VoidhashCoreClient["customersCreateCustomer"]>[0] }) => client.customersCreateCustomer(request.payload),
    getCustomerById: (request: { params: { readonly "customerId": string } }) => client.customersGetCustomerById(request.params["customerId"]),
    listCustomers: () => client.customersListCustomers(),
  },
  organizations: {
    createOrganization: (request: { payload: Parameters<VoidhashCoreClient["organizationsCreateOrganization"]>[0] }) => client.organizationsCreateOrganization(request.payload),
  },
  paymentProviderConfigurations: {
    listPaymentProviderConfigurations: () => client.paymentProviderConfigurationsListPaymentProviderConfigurations(),
  },
  paymentProviderProducts: {
    listPaymentProviderProducts: () => client.paymentProviderProductsListPaymentProviderProducts(),
  },
  paywallLocations: {
    listPaywallLocations: () => client.paywallLocationsListPaywallLocations(),
  },
  perks: {
    listPerks: () => client.perksListPerks(),
  },
  productPerks: {
    listProductPerksByProductId: (request: { params: { readonly "productId": string } }) => client.productPerksListProductPerksByProductId(request.params["productId"]),
  },
  products: {
    listProducts: () => client.productsListProducts(),
  },
  projects: {
    createProject: (request: { payload: Parameters<VoidhashCoreClient["projectsCreateProject"]>[0] }) => client.projectsCreateProject(request.payload),
    listProjects: (request: { params: { readonly "organizationId": string } }) => client.projectsListProjects(request.params["organizationId"]),
  },
  users: {
    getUser: () => client.usersGetUser(),
  },
  webhooks: {
    createWebhookEndpoint: (request: { payload: Parameters<VoidhashCoreClient["webhooksCreateWebhookEndpoint"]>[0] }) => client.webhooksCreateWebhookEndpoint(request.payload),
    deleteWebhookEndpoint: (request: { params: { readonly "endpointId": string } }) => client.webhooksDeleteWebhookEndpoint(request.params["endpointId"]),
    getWebhookDelivery: (request: { params: { readonly "deliveryId": string } }) => client.webhooksGetWebhookDelivery(request.params["deliveryId"]),
    getWebhookEndpoint: (request: { params: { readonly "endpointId": string } }) => client.webhooksGetWebhookEndpoint(request.params["endpointId"]),
    listWebhookDeliveries: () => client.webhooksListWebhookDeliveries(),
    listWebhookEndpoints: () => client.webhooksListWebhookEndpoints(),
    retryWebhookDelivery: (request: { params: { readonly "deliveryId": string } }) => client.webhooksRetryWebhookDelivery(request.params["deliveryId"]),
    rotateWebhookSecret: (request: { params: { readonly "endpointId": string } }) => client.webhooksRotateWebhookSecret(request.params["endpointId"]),
    testWebhookEndpoint: (request: { params: { readonly "endpointId": string } }) => client.webhooksTestWebhookEndpoint(request.params["endpointId"]),
    updateWebhookEndpoint: (request: { params: { readonly "endpointId": string }; payload: Parameters<VoidhashCoreClient["webhooksUpdateWebhookEndpoint"]>[1] }) => client.webhooksUpdateWebhookEndpoint(request.params["endpointId"], request.payload),
  },
});

export type GroupedVoidhashNodeEffectClient = ReturnType<typeof groupCoreClient>;
