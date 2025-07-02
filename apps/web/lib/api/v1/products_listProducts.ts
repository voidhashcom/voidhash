import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { productResponseSchema } from "./schema";
import { z } from "zod";
import { App } from "../hono/app";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { ProductService } from "@/lib/services/products/product.service";
import { Effect } from "effect";
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
	app.get("/v1/products", route, async (c) =>
		createEffectHandler(c)(
			Effect.gen(function* () {
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate();
				const productService = yield* ProductService;
				const projectId = yield* AuthSession.provide(authSession)(
					authService.getAuthorizedProjectId()
				);
				const products = yield* AuthSession.provide(authSession)(
					productService.getProducts(projectId)
				);

				return c.json<z.infer<typeof productResponseSchema>[]>(
					products.map((product) => ({
						productId: product.id,
						name: product.name,
					}))
				);
			})
		)
	);

export type RouteResponse = z.infer<typeof productResponseSchema>[];
