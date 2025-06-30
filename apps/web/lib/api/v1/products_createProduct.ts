import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createProductBodySchema, productResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { ProductService } from "@/lib/services/products/product.service";
import { Effect } from "effect";
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
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			const projectId = authSession.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.die(new Error("Project not found"));
			}
			
			const productService = yield* ProductService;
			const createdProduct = yield* AuthSession.provide(authSession)(
				productService.createProduct({
					name: c.req.valid("json").name,
					projectId,
				})
			);

			// Get the created product to return full details
			const product = yield* AuthSession.provide(authSession)(
				productService.getProductById(createdProduct.id)
			);

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: product.id,
				name: product.name,
			});
		}))
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
export type RouteRequest = z.infer<typeof createProductBodySchema>;
