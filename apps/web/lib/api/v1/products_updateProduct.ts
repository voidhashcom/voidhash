import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import {
	productResponseSchema,
	updateProductBodySchema,
	updateProductParamsSchema,
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

const route = describeRoute({
	description: "Update a product",
	operationId: "updateProduct",
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

export const registerProductsUpdateProduct = (app: App) =>
	app.put(
		"/v1/products/:productId",
		route,
		zValidator("param", updateProductParamsSchema),
		zValidator("json", updateProductBodySchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const productService = yield* ProductService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const productId = c.req.param("productId");
							const name = c.req.valid("json").name;
							yield* productService
								.updateProduct({
									productId: productId,
									name,
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
								);
							const product = yield* productService.getProductById(productId);

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
export type RouteRequest = z.infer<typeof updateProductBodySchema>;
