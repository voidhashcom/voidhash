import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	productResponseSchema,
	updateProductBodySchema,
	updateProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { updateProduct } from "@/lib/services/products/update-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Update a product",
	operationId: "updateProduct",
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

export const registerProductsUpdateProduct = (app: App) =>
	app.put(
		"/v1/products/:productId",
		route,
		zValidator("param", updateProductParamsSchema),
		zValidator("json", updateProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const name = c.req.valid("json").name;

			const updatedProduct = await updateProduct.invoke({
				ctx: authenticatedContext,
				input: {
					productId: productId,
					name,
				},
			});

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: updatedProduct.id,
				name: updatedProduct.name,
			});
		}
	);
