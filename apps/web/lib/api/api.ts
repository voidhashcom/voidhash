import { Hono } from "hono";
import { VoidhashError } from "@voidhash/lib/constants";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { v1 } from "./v1";
import { Scalar } from "@scalar/hono-api-reference";

export let app = new Hono();

const basePath = process.env.NODE_ENV === "development" ? "/api" : "";

app = app.basePath(basePath);

app.route("/v1", v1);
app.get(
	"/docs",
	Scalar({
		sources: [
			{
				url: `${basePath}/v1/openapi`,
				title: "v1",
			},
		],
		theme: "default",
	})
);

app.onError((err, c) => {
	if (err instanceof VoidhashError) {
		// Get the custom response
		return c.json({ message: err.message }, err.code as ContentfulStatusCode);
	}
	return c.json({ message: "Internal server error" }, 500);
});
