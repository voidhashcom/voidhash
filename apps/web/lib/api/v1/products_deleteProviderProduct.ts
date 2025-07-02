import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { deleteProviderProductParamsSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import {
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { Effect } from "effect";
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
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const productService = yield* ProductService;
					yield* AuthSession.provide(authSession)(
						productService
							.deletePaymentProviderProduct({
								productId: c.req.param("productId"),
								paymentProviderConfigurationId: c.req.param(
									"paymentProviderConfigurationId"
								),
								providerProductKey: c.req.param("providerProductKey"),
							})
							.pipe(
								Effect.catchTags({
									ProductNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "NOT_FOUND",
												message: error.message,
												originalError: error,
											})
										),
								})
							)
					);

					return c.json({ message: "Provider product deleted" });
				})
			)
	);
