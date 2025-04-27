import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	getProviderProductsParamsSchema,
	providerProductResponseSchema,
} from "./schema";
import { z } from "zod";
import { getProviderProductsByProductId } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Get all provider products for a product",
	operationId: "getProviderProductsByProductId",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.array(providerProductResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsGetProviderProductsByProductId = (app: App) =>
	app.get(
		"/v1/products/:productId/provider-products",
		route,
		zValidator("param", getProviderProductsParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			const providerProducts = await getProviderProductsByProductId({
				ctx: authenticatedContext,
				input: {
					productId,
				},
			});

			return c.json<z.infer<typeof providerProductResponseSchema>[]>(
				providerProducts.map((providerProduct) => ({
					providerProductKey: providerProduct.providerProductKey,
					providerConfiguration: {
						providerId: providerProduct.providerId,
						configuration: providerProduct.configuration,
					},
				}))
			);
		}
	);
