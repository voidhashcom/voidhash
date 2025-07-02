import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { getProductByIdParamsSchema, productResponseSchema } from "./schema";
import { z } from "zod";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import {
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { ProductService } from "@/lib/services/products/product.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Get a product",
	operationId: "getProductById",
	security: [
		{
			secretKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(productResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsGetProductById = (app: App) =>
	app.get(
		"/v1/products/:productId",
		route,
		zValidator("param", getProductByIdParamsSchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const productService = yield* ProductService;
					const product = yield* AuthSession.provide(authSession)(
						productService.getProductById(c.req.param("productId"))
					);

					if (!product) {
						return yield* Effect.fail(
							new HonoErrorResponse({
								code: "NOT_FOUND",
								message: "Product not found",
							})
						);
					}

					return c.json<z.infer<typeof productResponseSchema>>({
						productId: product.id,
						name: product.name,
					});
				})
			)
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
