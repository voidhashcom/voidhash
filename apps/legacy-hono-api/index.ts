import { API_DOMAIN } from '@voidhash/lib/constants';
import { openAPISpecs } from 'hono-openapi';
import { newApp } from './hono/app';
import { registerAppStoreValidateTransaction } from './v1/app-store_validateTransaction';
import { registerCustomersGetCustomerByAppUserId } from './v1/customers_getCustomerByAppUserId';
import { registerSdkGetCustomer } from './v1/sdk_getCustomer';
import { registerSdkIdentify } from './v1/sdk_identify';
import { registerSdkSyncCustomerAttributes } from './v1/sdk_syncCustomerAttributes';

const app = newApp();

const url =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `${API_DOMAIN}`;

// Customers
// registerCustomersCreateCustomer(app);
// registerCustomersListCustomers(app);
registerCustomersGetCustomerByAppUserId(app);

// Paywalls
// registerPaywallsCreatePaywall(app);
// registerPaywallsListPaywalls(app);
// registerPaywallsGetPaywallById(app);
// registerPaywallsDeletePaywall(app);
// registerPaywallsAttachProductToPaywall(app);
// registerPaywallsGetPaywallProducts(app);
// registerPaywallsDeletePaywallProduct(app);

// Products
// registerProductsCreateProduct(app);
// registerProductsListProducts(app);
// registerProductsGetProductById(app);
// registerProductsUpdateProduct(app);
// registerProductsDeleteProduct(app);
// registerProductsAttachProviderProduct(app);
// registerProductsGetProviderProductsByProductId(app);
// registerProductsUpdateProviderProduct(app);
// registerProductsDeleteProviderProduct(app);

// SDK
// registerSdkCreateCheckout(app);
registerSdkGetCustomer(app);
registerSdkIdentify(app);
// registerSdkGetPaywallByLocation(app);
registerSdkSyncCustomerAttributes(app);

// Payment Providers
registerAppStoreValidateTransaction(app);

app.get(
  '/v1/openapi',
  openAPISpecs(app, {
    documentation: {
      info: {
        title: 'Voidhash API',
        version: '1.0.0',
        description: 'API'
      },
      components: {
        securitySchemes: {
          personalApiKey: {
            description: 'Personal API key',
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header'
          },
          secretKey: {
            description: 'Secret API key',
            type: 'apiKey',
            name: 'x-secret-key',
            in: 'header'
          },
          publishableKey: {
            description: 'Publishable API key',
            type: 'apiKey',
            name: 'x-publishable-key',
            in: 'header'
          }
        }
      },
      servers: [{ url, description: 'Local Server' }]
    }
  })
);

export default app;
