import { openAPISpecs } from "hono-openapi";
import { newApp } from "./hono/app";
import { API_DOMAIN } from "@voidhash/lib/constants";
import { registerCustomersListCustomers } from "./v1/customers_listCustomers";
import { registerCustomersGetCustomerByAppUserId } from "./v1/customers_getCustomerByAppUserId";
import { registerPaywallsCreatePaywall } from "./v1/paywalls_createPaywall";
import { registerPaywallsListPaywalls } from "./v1/paywalls_listPaywalls";
import { registerPaywallsGetPaywallById } from "./v1/paywalls_getPaywallById";
import { registerPaywallsDeletePaywall } from "./v1/paywalls_deletePaywall";
import { registerPaywallsAttachProductToPaywall } from "./v1/paywalls_attachProductToPaywall";
import { registerPaywallsGetPaywallProducts } from "./v1/paywalls_getPaywallProducts";
import { registerPaywallsDeletePaywallProduct } from "./v1/paywalls_deletePaywallProduct";
import { registerProductsCreateProduct } from "./v1/products_createProduct";
import { registerProductsListProducts } from "./v1/products_listProducts";
import { registerProductsGetProductById } from "./v1/products_getProductById";
import { registerProductsUpdateProduct } from "./v1/products_updateProduct";
import { registerProductsDeleteProduct } from "./v1/products_deleteProduct";
import { registerProductsAttachProviderProduct } from "./v1/products_attachProviderProduct";
import { registerProductsGetProviderProductsByProductId } from "./v1/products_getProviderProductsByProductId";
import { registerProductsUpdateProviderProduct } from "./v1/products_updateProviderProduct";
import { registerProductsDeleteProviderProduct } from "./v1/products_deleteProviderProduct";
import { registerCustomersCreateCustomer } from "./v1/customers_createCustomer";
import { paymentProviderApis } from "../payment-providers/payment-provider-apis";

export const app = newApp();

const url =
	process.env.NODE_ENV === "development"
		? "http://localhost:3000/api/v1"
		: `${API_DOMAIN}/v1`;

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
