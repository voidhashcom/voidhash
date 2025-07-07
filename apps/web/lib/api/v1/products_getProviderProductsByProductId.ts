import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import {
	getProviderProductsParamsSchema,
	providerProductResponseSchema,
} from "./schema";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { ProductService } from "@/lib/services/product.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

const route = describeRoute({
	description: "Get all provider products for a product",
	operationId: "getProviderProductsByProductId",
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
					schema: resolver(z.array(providerProductResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsGetProviderProductsByProductId = (app: App) =>
	app.get(
		"/v1/products/:productId/provider-products",
		route,
		zValidator("param", getProviderProductsParamsSchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const productService = yield* ProductService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const providerProducts =
								yield* productService.getProviderProductsByProductId(
									c.req.param("productId")
								);

							return c.json<z.infer<typeof providerProductResponseSchema>[]>(
								providerProducts.map((providerProduct) => ({
									providerProductKey: providerProduct.providerProductKey,
									providerConfiguration: {
										paymentProviderConfigurationId:
											providerProduct.paymentProviderConfigurationId,
										configuration: providerProduct.configuration,
									},
								}))
							);
						})
					);
				})
			)
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>[];
