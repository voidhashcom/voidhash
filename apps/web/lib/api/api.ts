import { Hono } from "hono";
// import { VoidhashError } from "@voidhash/lib/constants";
// import { ContentfulStatusCode } from "hono/utils/http-status";
import { v1 } from "./v1";
import { Scalar } from "@scalar/hono-api-reference";
import { handleError } from "./errors/http";
import { prettyJSON } from "hono/pretty-json";
import { HonoEnv } from "./hono/env";

export let app = new Hono<HonoEnv>();

const basePath = process.env.NODE_ENV === "development" ? "/api" : "";

app = app.basePath(basePath);
app.use(prettyJSON());
app.onError(handleError);

app.use("*", (c, next) => {
	// TODO: Fix this for vercel
	c.set(
		"location",
		c.req.header("True-Client-IP") ??
			c.req.header("CF-Connecting-IP") ??
			// @ts-expect-error - the cf object will be there on cloudflare
			c.req.raw?.cf?.colo ??
			""
	);
	c.set("userAgent", c.req.header("User-Agent"));

	return next();
});

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

// app.onError((err, c) => {
// 	if (err instanceof VoidhashError) {
// 		// Get the custom response
// 		return c.json({ message: err.message }, err.code as ContentfulStatusCode);
// 	}
// 	return c.json({ message: "Internal server error" }, 500);
// });
