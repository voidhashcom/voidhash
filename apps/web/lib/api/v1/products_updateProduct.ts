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
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
		async (c) => {
			const runtime = createHonoRuntime(c);
			const productId = c.req.param("productId");
			const name = c.req.valid("json").name;

			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.updateProduct({
								productId: productId,
								name,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			// Get the updated product to return full details
			const getResult = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.getProductById(productId)
						)
					))
				}))
			);

			if (getResult.error) {
				throw toVoidhashHTTPError(getResult.error);
			}

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: getResult.data.id,
				name: getResult.data.name,
			});
		}
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
export type RouteRequest = z.infer<typeof updateProductBodySchema>;
