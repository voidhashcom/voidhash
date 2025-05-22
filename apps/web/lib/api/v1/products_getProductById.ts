import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { getProductByIdParamsSchema, productResponseSchema } from "./schema";
import { z } from "zod";
import { getProductById } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

const route = describeRoute({
	description: "Get a product",
	operationId: "getProductById",
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

export const registerProductsGetProductById = (app: App) =>
	app.get(
		"/v1/products/:productId",
		route,
		zValidator("param", getProductByIdParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}

			const productId = c.req.param("productId");

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
