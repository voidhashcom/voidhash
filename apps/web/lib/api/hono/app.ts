import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";
import { prettyJSON } from "hono/pretty-json";
import { HonoEnv } from "./env";
import { handleError } from "../errors/http";
import type { Context as GenericContext } from "hono";
import { cors } from "hono/cors";
import { init } from "./middleware/init";

export function newApp() {
	let app = new Hono<HonoEnv>();

	const basePath = process.env.NODE_ENV === "development" ? "/api" : "";

	app = app.basePath(basePath);
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

	app.use(init());
	app.use(cors());
	app.use(prettyJSON());

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

	app.onError(handleError);
	return app;
}

export type App = ReturnType<typeof newApp>;
export type Context = GenericContext<HonoEnv>;
