import { API_DOMAIN } from '@voidhash/lib/constants';
import { openAPISpecs } from 'hono-openapi';
import { paymentProviderApis } from '@/lib/payment-providers/payment-providers-api';
import { newApp } from './hono/app';
import { registerCustomersCreateCustomer } from './v1/customers_createCustomer';
import { registerCustomersGetCustomerByAppUserId } from './v1/customers_getCustomerByAppUserId';
import { registerCustomersListCustomers } from './v1/customers_listCustomers';
import { registerPaywallsCreatePaywall } from './v1/paywalls_createPaywall';
import { registerPaywallsDeletePaywall } from './v1/paywalls_deletePaywall';
import { registerPaywallsGetPaywallById } from './v1/paywalls_getPaywallById';
// import { registerPaywallsAttachProductToPaywall } from "./v1/paywalls_attachProductToPaywall";
import { registerPaywallsGetPaywallProducts } from './v1/paywalls_getPaywallProducts';
import { registerPaywallsListPaywalls } from './v1/paywalls_listPaywalls';
import { registerProductsAttachProviderProduct } from './v1/products_attachProviderProduct';
// import { registerPaywallsDeletePaywallProduct } from "./v1/paywalls_deletePaywallProduct";
import { registerProductsCreateProduct } from './v1/products_createProduct';
import { registerProductsDeleteProduct } from './v1/products_deleteProduct';
import { registerProductsDeleteProviderProduct } from './v1/products_deleteProviderProduct';
import { registerProductsGetProductById } from './v1/products_getProductById';
import { registerProductsGetProviderProductsByProductId } from './v1/products_getProviderProductsByProductId';
import { registerProductsListProducts } from './v1/products_listProducts';
import { registerProductsUpdateProduct } from './v1/products_updateProduct';
import { registerProductsUpdateProviderProduct } from './v1/products_updateProviderProduct';
import { registerSdkCreateCheckout } from './v1/sdk_createCheckout';
import { registerSdkGetCustomer } from './v1/sdk_getCustomer';
import { registerSdkGetPaywallByLocation } from './v1/sdk_getPaywallByLocation';
import { registerSdkIdentify } from './v1/sdk_identify';
import { registerSdkSyncCustomerAttributes } from './v1/sdk_syncCustomerAttributes';

const app = newApp();

const url =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `${API_DOMAIN}`;

// Customers
registerCustomersCreateCustomer(app);
registerCustomersListCustomers(app);
registerCustomersGetCustomerByAppUserId(app);

// Paywalls
registerPaywallsCreatePaywall(app);
registerPaywallsListPaywalls(app);
registerPaywallsGetPaywallById(app);
registerPaywallsDeletePaywall(app);
// registerPaywallsAttachProductToPaywall(app);
registerPaywallsGetPaywallProducts(app);
// registerPaywallsDeletePaywallProduct(app);

// Products
registerProductsCreateProduct(app);
registerProductsListProducts(app);
registerProductsGetProductById(app);
registerProductsUpdateProduct(app);
registerProductsDeleteProduct(app);
registerProductsAttachProviderProduct(app);
registerProductsGetProviderProductsByProductId(app);
registerProductsUpdateProviderProduct(app);
registerProductsDeleteProviderProduct(app);

// SDK
registerSdkCreateCheckout(app);
registerSdkGetCustomer(app);
registerSdkIdentify(app);
registerSdkGetPaywallByLocation(app);
registerSdkSyncCustomerAttributes(app);

for (const api of paymentProviderApis) {
  api.registerEndpoints(app);
}

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

export { app };
