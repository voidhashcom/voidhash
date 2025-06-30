import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { productResponseSchema } from "./schema";
import { z } from "zod";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "List products",
	operationId: "listProducts",
	security: [
		{
			secretKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.array(productResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsListProducts = (app: App) =>
	app.get("/v1/products", route, async (c) => {
		const runtime = createHonoRuntime(c);
		const result = await tryCatch(
			runtime.runPromise(Effect.gen(function* () {
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate;
				const projectId = authSession.projects[0]?.id;
				if (!projectId) {
					return yield* Effect.die(new Error("Project not found"));
				}
				
				return yield* AuthSession.provide(authSession)(pipe(
					ProductService,
					Effect.flatMap((productService) =>
						productService.getProducts(projectId)
					)
				))
			}))
		);

		if (result.error) {
			throw toVoidhashHTTPError(result.error);
		}

		return c.json<z.infer<typeof productResponseSchema>[]>(
			result.data.map((product) => ({
				productId: product.id,
				name: product.name,
			}))
		);
	});

export type RouteResponse = z.infer<typeof productResponseSchema>[];
