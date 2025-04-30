import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { getProductByIdParamsSchema, productResponseSchema } from "./schema";
import { z } from "zod";
import { getProductById } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Get a product",
	operationId: "getProductById",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(productResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsGetProductById = (app: App) =>
	app.get(
		"/v1/products/:productId",
		route,
		zValidator("param", getProductByIdParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			const product = await getProductById({
				ctx: authenticatedContext,
				input: {
					id: productId,
				},
			});

			if (!product) {
				return c.json({ error: "Product not found" }, 404);
			}

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: product.id,
				name: product.name,
			});
		}
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
