import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createProductBodySchema, productResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { ProductService } from "@/lib/services/products/product.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Create a new product",
	operationId: "createProduct",
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

export const registerProductsCreateProduct = (app: App) =>
	app.post(
		"/v1/products",
		route,
		zValidator("json", createProductBodySchema),
		async (c) => {
			const runtime = createHonoRuntime(c);
			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					const projectId = authSession.projects[0]?.id;
					if (!projectId) {
						return yield* Effect.die(new Error("Project not found"));
					}
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.createProduct({
								name: c.req.valid("json").name,
								projectId,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			// Get the created product to return full details
			const getResult = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						ProductService,
						Effect.flatMap((productService) =>
							productService.getProductById(result.data.id)
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
export type RouteRequest = z.infer<typeof createProductBodySchema>;
