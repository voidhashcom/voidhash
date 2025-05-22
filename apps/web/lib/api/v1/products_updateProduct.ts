import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	productResponseSchema,
	updateProductBodySchema,
	updateProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { updateProduct } from "@/lib/services/products/actions/update-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { getProductById } from "@/lib/services/products/queries";

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
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const productId = c.req.param("productId");
			const name = c.req.valid("json").name;

			const updatedProduct = await updateProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					productId: productId,
					name,
				},
			});
			if (updatedProduct.isErr()) {
				throw toVoidhashHTTPError(updatedProduct.error);
			}

			const product = await getProductById({
				ctx: authenticatedContext.value,
				input: {
					id: productId,
				},
			});
			if (product.isErr()) {
				throw toVoidhashHTTPError(product.error);
			}

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: product.value.id,
				name: product.value.name,
			});
		}
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
export type RouteRequest = z.infer<typeof updateProductBodySchema>;
