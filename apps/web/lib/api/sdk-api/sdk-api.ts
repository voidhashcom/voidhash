import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";

const sdkApi = new Hono().basePath("/sdk");
sdkApi.get("/", (c) => c.text("SDK Api")); // GET /user

sdkApi.get(
	"/openapi",
	openAPISpecs(sdkApi, {
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

export { sdkApi };
