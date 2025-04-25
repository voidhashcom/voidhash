import { Hono } from "hono";
import customers from "./endpoints/customers";
import paywalls from "./endpoints/paywalls";
import products from "./endpoints/products";
import { openAPISpecs } from "hono-openapi";
import { API_DOMAIN } from "@voidhash/lib/constants";

const app = new Hono();

const url =
	process.env.NODE_ENV === "development"
		? "http://localhost:3000/api/v1"
		: `${API_DOMAIN}/v1`;

app.route("/customers", customers);
app.route("/paywalls", paywalls);
app.route("/products", products);

// OpenAPI specs
app.get(
	"/openapi",
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

export { app as v1 };
