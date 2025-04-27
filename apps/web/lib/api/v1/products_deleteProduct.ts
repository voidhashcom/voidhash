import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { deleteProductParamsSchema } from "./schema";
import { z } from "zod";
import { deleteProduct } from "@/lib/services/products/delete-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Delete a product",
	operationId: "deleteProduct",
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
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsDeleteProduct = (app: App) =>
	app.delete(
		"/v1/products/:productId",
		route,
		zValidator("param", deleteProductParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			await deleteProduct.invoke({
				ctx: authenticatedContext,
				input: {
					productId,
				},
			});

			return c.json({ message: "Product deleted" });
		}
	);
