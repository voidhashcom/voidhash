import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import {
	attachProviderProductBodySchema,
	attachProviderProductParamsSchema,
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
	description: "Attach a new provider product",
	operationId: "attachProviderProduct",
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

export const registerProductsAttachProviderProduct = (app: App) =>
	app.post(
		"/v1/products/:productId/provider-products",
		route,
		zValidator("param", attachProviderProductParamsSchema),
		zValidator("json", attachProviderProductBodySchema),
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
							productService.createPaymentProviderProduct({
								productId,
								paymentProviderConfigurationId:
									c.req.valid("json").paymentProviderConfigurationId,
								configuration: c.req.valid("json").configuration,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json<z.infer<typeof providerProductResponseSchema>>({
				providerProductKey: result.data.providerProductKey,
				providerConfiguration: {
					paymentProviderConfigurationId:
						result.data.paymentProviderConfigurationId,
					configuration: result.data.configuration,
				},
			});
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof attachProviderProductBodySchema>;
