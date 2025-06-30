import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import {
	providerProductResponseSchema,
	updateProviderProductBodySchema,
	updateProviderProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import {
	toVoidhashHTTPError,
} from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Update a provider product",
	operationId: "updateProviderProduct",
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
					schema: resolver(providerProductResponseSchema),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsUpdateProviderProduct = (app: App) =>
	app.put(
		"/v1/products/:productId/provider-products/:paymentProviderConfigurationId/:providerProductKey",
		route,
		zValidator("param", updateProviderProductParamsSchema),
		zValidator("json", updateProviderProductBodySchema),
		async (c) => {
			const runtime = createHonoRuntime(c);
			const productId = c.req.param("productId");
			const paymentProviderConfigurationId = c.req.param(
				"paymentProviderConfigurationId"
			);
			const providerProductKey = c.req.param("providerProductKey");
			const configuration = c.req.valid("json");

			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.updatePaymentProviderProduct({
								productId,
								paymentProviderConfigurationId: paymentProviderConfigurationId,
								configuration: configuration.configuration,
								providerProductKey,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			// Get the updated provider product to return full details
			const getResult = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.getProviderProductByPrimaryKey({
								paymentProviderConfigurationId: paymentProviderConfigurationId,
								providerProductKey: providerProductKey,
							})
						)
					))
				}))
			);

			if (getResult.error) {
				throw toVoidhashHTTPError(getResult.error);
			}

			return c.json<z.infer<typeof providerProductResponseSchema>>({
				providerProductKey: getResult.data.providerProductKey,
				providerConfiguration: {
					configuration: getResult.data.configuration,
					paymentProviderConfigurationId: getResult.data.paymentProviderConfigurationId,
				},
			});
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
