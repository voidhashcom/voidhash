import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { deleteProviderProductParamsSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { Effect, pipe } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";
import { ProductService } from "@/lib/services/products/product.service";

const route = describeRoute({
	description: "Delete a provider product",
	operationId: "deleteProviderProduct",
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
					schema: resolver(z.object({ message: z.string() })),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsDeleteProviderProduct = (app: App) =>
	app.delete(
		"/v1/products/:productId/provider-products/:paymentProviderConfigurationId/:providerProductKey",
		route,
		zValidator("param", deleteProviderProductParamsSchema),
		async (c) => {
			const runtime = createHonoRuntime(c);
			// const productId = c.req.param("productId");
			// const paymentProviderConfigurationId = c.req.param("paymentProviderConfigurationId");
			// const providerProductKey = c.req.param("providerProductKey");

			// Note: The ProductService doesn't expose deletePaymentProviderProduct method yet
			// This is a placeholder implementation that would need the method to be added
			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					// When the method is available in ProductService, use:
					const productId = c.req.param("productId");
					const paymentProviderConfigurationId = c.req.param("paymentProviderConfigurationId");
					const providerProductKey = c.req.param("providerProductKey");
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.deletePaymentProviderProduct({
								productId,
								paymentProviderConfigurationId,
								providerProductKey,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json({ message: "Provider product deleted" });
		}
	);
