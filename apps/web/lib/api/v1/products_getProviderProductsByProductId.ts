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
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
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
		async (c) => {
			const runtime = createHonoRuntime(c);
			const productId = c.req.param("productId");

			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.getProviderProductsByProductId(productId)
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json<z.infer<typeof providerProductResponseSchema>[]>(
				result.data.map((providerProduct) => ({
					providerProductKey: providerProduct.providerProductKey,
					providerConfiguration: {
						paymentProviderConfigurationId:
							providerProduct.paymentProviderConfigurationId,
						configuration: providerProduct.configuration,
					},
				}))
			);
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>[];
