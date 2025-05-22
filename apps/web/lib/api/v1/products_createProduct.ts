import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { createProductBodySchema, productResponseSchema } from "./schema";
import { z } from "zod";
import { createProduct } from "@/lib/services/products/actions/create-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";
import { getProductById } from "@/lib/services/products/queries";

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
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsCreateProduct = (app: App) =>
	app.post(
		"/v1/products",
		route,
		zValidator("json", createProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}

			const projectId = authenticatedContext.value.session?.projects[0]?.id;

			if (!projectId) {
				throw new VoidhashHTTPError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const createdProduct = await createProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});

			if (createdProduct.isErr()) {
				throw toVoidhashHTTPError(createdProduct.error);
			}

			const product = await getProductById({
				ctx: authenticatedContext.value,
				input: { id: createdProduct.value.id },
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
export type RouteRequest = z.infer<typeof createProductBodySchema>;
