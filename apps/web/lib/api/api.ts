import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { VoidhashError } from "@voidhash/lib/constants";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { v1 } from "./v1";

export const app = new Hono();

app.route("/", v1);

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
			servers: [
				{ url: "http://api.localhost:3000", description: "Local Server" },
			],
		},
	})
);
app
	.get("/docs", Scalar({ url: "/openapi", theme: "default" }))
	.onError((err, c) => {
		if (err instanceof VoidhashError) {
			// Get the custom response
			return c.json({ error: err.message }, err.code as ContentfulStatusCode);
		}
		return c.json({ error: "Internal server error" }, 500);
	});
