import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { deleteProductParamsSchema } from "./schema";
import { z } from "zod";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
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
							productService.deleteProduct({
								productId,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json({ message: "Product deleted" });
		}
	);
