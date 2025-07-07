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
import { ProductService } from "@/lib/services/product.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

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
					const authService = yield* AuthService;
					const productService = yield* ProductService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const product = yield* productService.getProductById(
								c.req.param("productId")
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
					);
				})
			)
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
