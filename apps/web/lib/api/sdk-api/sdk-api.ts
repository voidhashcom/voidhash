import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import customers from "./endpoints/customers";
import { Scalar } from "@scalar/hono-api-reference";

const app = new Hono().basePath("/sdk/v1");
app.get("/", (c) => c.text("SDK Api")); // GET /user

// Endpoints
app.route("/customers", customers);

// OpenAPI specs
app.get(
	"/openapi",
	openAPISpecs(app, {
		documentation: {
			info: {
				title: "Voidhash Client-SDK API",
				version: "1.0.0",
				description: "Client-SDK API",
			},
			servers: [{ url: "http://localhost:3000", description: "Local Server" }],
		},
	})
);
app.get("/docs", Scalar({ url: "/sdk/v1/openapi", theme: "default" }));

export { app as sdkApi };
