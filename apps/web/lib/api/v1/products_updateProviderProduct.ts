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
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { ProductService } from "@/lib/services/products/product.service";
import { Effect } from "effect";
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
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();

					const productService = yield* ProductService;
					const productId = c.req.param("productId");
					const paymentProviderConfigurationId = c.req.param(
						"paymentProviderConfigurationId"
					);
					const providerProductKey = c.req.param("providerProductKey");
					const configuration = c.req.valid("json");

					yield* AuthSession.provide(authSession)(
						productService
							.updatePaymentProviderProduct({
								productId,
								paymentProviderConfigurationId: paymentProviderConfigurationId,
								configuration: configuration.configuration,
								providerProductKey,
							})
							.pipe(
								Effect.catchTags({
									ProductNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "BAD_REQUEST",
												message: error.message,
												originalError: error,
											})
										),
									PaymentProviderConfigurationNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "BAD_REQUEST",
												message: error.message,
												originalError: error,
											})
										),
									PaymentProviderNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "BAD_REQUEST",
												message: error.message,
												originalError: error,
											})
										),
									ProviderProductNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "BAD_REQUEST",
												message: error.message,
												originalError: error,
											})
										),
									InvalidConfiguration: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "BAD_REQUEST",
												message: error.message,
												originalError: error,
											})
										),
								})
							)
					);

					// Get the updated provider product to return full details
					const providerProduct = yield* AuthSession.provide(authSession)(
						productService.getProviderProductByPrimaryKey({
							paymentProviderConfigurationId: paymentProviderConfigurationId,
							providerProductKey: providerProductKey,
						})
					);

					return c.json<z.infer<typeof providerProductResponseSchema>>({
						providerProductKey: providerProduct.providerProductKey,
						providerConfiguration: {
							configuration: providerProduct.configuration,
							paymentProviderConfigurationId:
								providerProduct.paymentProviderConfigurationId,
						},
					});
				})
			)
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
