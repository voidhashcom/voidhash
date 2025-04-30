import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	attachProviderProductBodySchema,
	attachProviderProductParamsSchema,
	providerProductResponseSchema,
} from "./schema";
import { z } from "zod";
import { createPaymentProviderProduct } from "@/lib/services/products/create-payment-provider-product";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Attach a new provider product",
	operationId: "attachProviderProduct",
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

export const registerProductsAttachProviderProduct = (app: App) =>
	app.post(
		"/v1/products/:productId/provider-products",
		route,
		zValidator("param", attachProviderProductParamsSchema),
		zValidator("json", attachProviderProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.valid("json").providerId;
			if (!providerId) {
				return c.json({ error: "Provider ID is required" }, 400);
			}
			if (!paymentProviders.find((p) => p.id === providerId)) {
				return c.json({ error: "Provider not found" }, 404);
			}

			const providerProduct = await createPaymentProviderProduct.invoke({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId: providerId as string,
					configuration: c.req.valid("json").configuration,
				},
			});

			return c.json<z.infer<typeof providerProductResponseSchema>>({
				providerProductKey: providerProduct.providerProductKey,
				providerConfiguration: {
					providerId: providerProduct.providerId,
					configuration: providerProduct.configuration,
				},
			});
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof attachProviderProductBodySchema>;
