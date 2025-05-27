import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	attachProviderProductBodySchema,
	attachProviderProductParamsSchema,
	providerProductResponseSchema,
} from "./schema";
import { z } from "zod";
import { createPaymentProviderProduct } from "@/lib/services/products/actions/create-payment-provider-product";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

const route = describeRoute({
	description: "Attach a new provider product",
	operationId: "attachProviderProduct",
	security: [
		{
			secretKey: [],
		},
	],
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
	tags: ["Products"],
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
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const productId = c.req.param("productId");
			const providerId = c.req.valid("json").providerId;
			if (!providerId) {
				return c.json({ error: "Provider ID is required" }, 400);
			}
			if (!paymentProviders.find((p) => p.id === providerId)) {
				return c.json({ error: "Provider not found" }, 404);
			}

			const providerProduct = await createPaymentProviderProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					productId,
					providerId: providerId as string,
					configuration: c.req.valid("json").configuration,
				},
			});
			if (providerProduct.isErr()) {
				throw toVoidhashHTTPError(providerProduct.error);
			}
			return c.json<z.infer<typeof providerProductResponseSchema>>({
				providerProductKey: providerProduct.value.providerProductKey,
				providerConfiguration: {
					providerId: providerProduct.value.providerId,
					configuration: providerProduct.value.configuration,
				},
			});
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof attachProviderProductBodySchema>;
