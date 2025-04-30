import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	providerProductResponseSchema,
	updateProviderProductBodySchema,
	updateProviderProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { updatePaymentProviderProduct } from "@/lib/services/products/update-payment-provider-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Update a provider product",
	operationId: "updateProviderProduct",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(providerProductResponseSchema),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsUpdateProviderProduct = (app: App) =>
	app.put(
		"/v1/products/:productId/provider-products/:providerId/:providerProductKey",
		route,
		zValidator("param", updateProviderProductParamsSchema),
		zValidator("json", updateProviderProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.param("providerId");
			const providerProductKey = c.req.param("providerProductKey");
			const configuration = c.req.valid("json").configuration.configuration;

			const updatedProviderProduct = await updatePaymentProviderProduct.invoke({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId,
					configuration,
					providerProductKey,
				},
			});

			// Construct the response according to the providerProductResponseSchema
			// The service returns the *inner* configuration, but the response schema expects
			// the full wrapper object { providerId: string, configuration: object }.
			const responseBody: z.infer<typeof providerProductResponseSchema> = {
				providerProductKey: updatedProviderProduct.providerProductKey,
				providerConfiguration: {
					providerId: providerId, // Use the providerId from the request params
					configuration: updatedProviderProduct.configuration, // This is the inner config object
				},
			};

			return c.json(responseBody);
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
