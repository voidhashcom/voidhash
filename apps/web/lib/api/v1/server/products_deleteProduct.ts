import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { deleteProductParamsSchema } from "./schema";
import { z } from "zod";
import { deleteProduct } from "@/lib/services/products/actions/delete-product";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

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
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const productId = c.req.param("productId");

			const deletedProduct = await deleteProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					productId,
				},
			});

			if (deletedProduct.isErr()) {
				throw toVoidhashHTTPError(deletedProduct.error);
			}

			return c.json({ message: "Product deleted" });
		}
	);
