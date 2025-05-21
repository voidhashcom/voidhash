import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	getProviderProductsParamsSchema,
	providerProductResponseSchema,
} from "./schema";
import { z } from "zod";
import { getProviderProductsByProductId } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

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
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const productId = c.req.param("productId");

			const providerProducts = await getProviderProductsByProductId({
				ctx: authenticatedContext.value,
				input: {
					productId,
				},
			});

			if (providerProducts.isErr()) {
				throw toVoidhashHTTPError(providerProducts.error);
			}

			return c.json<z.infer<typeof providerProductResponseSchema>[]>(
				providerProducts.value.map((providerProduct) => ({
					providerProductKey: providerProduct.providerProductKey,
					providerConfiguration: {
						providerId: providerProduct.providerId,
						configuration: providerProduct.configuration,
					},
				}))
			);
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>[];
