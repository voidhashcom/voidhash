import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { deleteProductParamsSchema } from "./schema";
import { z } from "zod";
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
	description: "Delete a product",
	operationId: "deleteProduct",
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

export const registerProductsDeleteProduct = (app: App) =>
	app.delete(
		"/v1/products/:productId",
		route,
		zValidator("param", deleteProductParamsSchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const productService = yield* ProductService;
					yield* AuthSession.provide(authSession)(
						productService
							.deleteProduct({
								productId: c.req.param("productId"),
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

					return c.json({ message: "Product deleted" });
				})
			)
	);
