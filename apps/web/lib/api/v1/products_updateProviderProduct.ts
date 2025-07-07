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
import { ProductService } from "@/lib/services/product.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";

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
		"/v1/products/:productId/provider-products/:paymentProviderConfigurationProductId",
		route,
		zValidator("param", updateProviderProductParamsSchema),
		zValidator("json", updateProviderProductBodySchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const productService = yield* ProductService;
					const environmentService = yield* EnvironmentService;
					const authSession = yield* authService.authenticateWithSecretKey();

					const paymentProviderConfigurationProductId = c.req.param(
						"paymentProviderConfigurationProductId"
					);
					const configuration = c.req.valid("json");

					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromApiAuthSession();
							return yield* Environment.provide(environment)(
								Effect.gen(function* () {
									yield* productService.updatePaymentProviderProduct({
										paymentProviderConfigurationProductId:
											paymentProviderConfigurationProductId,
										configuration: configuration.configuration,
									});

									
									// Get the updated provider product to return full details
									const providerProduct =
										yield* productService.getProviderProductById(
											paymentProviderConfigurationProductId
										);

										console.log("updatePaymentProviderProduct!");

									return c.json<z.infer<typeof providerProductResponseSchema>>({
										providerProductKey: providerProduct.providerProductKey,
										providerConfiguration: {
											configuration: providerProduct.configuration,
											paymentProviderConfigurationId:
												providerProduct.paymentProviderConfigurationId,
										},
									});
								})
							);
						}).pipe(
							Effect.catchTags({
								ProductNotFound: (error) =>
									Effect.fail(
										new HonoErrorResponse({
											code: "NOT_FOUND",
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
											code: "NOT_FOUND",
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
				})
			)
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
