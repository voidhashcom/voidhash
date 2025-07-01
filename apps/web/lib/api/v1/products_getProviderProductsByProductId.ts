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
import { ProductService } from "@/lib/services/products/product.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const productService = yield* ProductService;
					const providerProducts = yield* AuthSession.provide(authSession)(
						productService.getProviderProductsByProductId(
							c.req.param("productId")
						)
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
			)
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>[];
