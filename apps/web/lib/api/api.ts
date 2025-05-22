import { openAPISpecs } from "hono-openapi";
import { newApp } from "./hono/app";
import { API_DOMAIN } from "@voidhash/lib/constants";
import { registerCustomersListCustomers } from "./v1/server/customers_listCustomers";
import { registerCustomersGetCustomerByAppUserId } from "./v1/server/customers_getCustomerByAppUserId";
import { registerPaywallsCreatePaywall } from "./v1/server/paywalls_createPaywall";
import { registerPaywallsListPaywalls } from "./v1/server/paywalls_listPaywalls";
import { registerPaywallsGetPaywallById } from "./v1/server/paywalls_getPaywallById";
import { registerPaywallsDeletePaywall } from "./v1/server/paywalls_deletePaywall";
import { registerPaywallsAttachProductToPaywall } from "./v1/server/paywalls_attachProductToPaywall";
import { registerPaywallsGetPaywallProducts } from "./v1/server/paywalls_getPaywallProducts";
import { registerPaywallsDeletePaywallProduct } from "./v1/server/paywalls_deletePaywallProduct";
import { registerProductsCreateProduct } from "./v1/server/products_createProduct";
import { registerProductsListProducts } from "./v1/server/products_listProducts";
import { registerProductsGetProductById } from "./v1/server/products_getProductById";
import { registerProductsUpdateProduct } from "./v1/server/products_updateProduct";
import { registerProductsDeleteProduct } from "./v1/server/products_deleteProduct";
import { registerProductsAttachProviderProduct } from "./v1/server/products_attachProviderProduct";
import { registerProductsGetProviderProductsByProductId } from "./v1/server/products_getProviderProductsByProductId";
import { registerProductsUpdateProviderProduct } from "./v1/server/products_updateProviderProduct";
import { registerProductsDeleteProviderProduct } from "./v1/server/products_deleteProviderProduct";
import { registerCustomersCreateCustomer } from "./v1/server/customers_createCustomer";
import { paymentProviderApis } from "../payment-providers/payment-provider-apis";

export const app = newApp();

const url =
	process.env.NODE_ENV === "development"
		? "http://localhost:3000"
		: `${API_DOMAIN}`;

// Customers
registerCustomersCreateCustomer(app);
registerCustomersListCustomers(app);
registerCustomersGetCustomerByAppUserId(app);

// // Paywalls
registerPaywallsCreatePaywall(app);
registerPaywallsListPaywalls(app);
registerPaywallsGetPaywallById(app);
registerPaywallsDeletePaywall(app);
registerPaywallsAttachProductToPaywall(app);
registerPaywallsGetPaywallProducts(app);
registerPaywallsDeletePaywallProduct(app);

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

paymentProviderApis.forEach((api) => api.registerEndpoints(app));

app.get(
	"/v1/openapi",
	openAPISpecs(app, {
		documentation: {
			info: {
				title: "Voidhash API",
				version: "1.0.0",
				description: "API",
			},
			servers: [{ url, description: "Local Server" }],
		},
	})
);
