import { Hono } from "hono";
import { sdkApi } from "./sdk-api/sdk-api";
import { serverApi } from "./server-api/server-api";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

export const app = new Hono();

app.route("/", sdkApi); // Handle /book
app.route("/", serverApi); // Handle /user

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
			servers: [{ url: "http://localhost:3000", description: "Local Server" }],
		},
	})
);
app.get("/docs", Scalar({ url: "/openapi", theme: "default" }));
