import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { deleteProviderProductParamsSchema } from "./schema";
// import { z } from "zod";
import { deletePaymentProviderProduct } from "@/lib/services/products/actions/delete-payment-provider-product";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Delete a provider product",
	operationId: "deleteProviderProduct",
	responses: {
		200: {
			description: "Successful response",
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsDeleteProviderProduct = (app: App) =>
	app.delete(
		"/v1/products/:productId/provider-products/:providerId/:providerProductKey",
		route,
		zValidator("param", deleteProviderProductParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.param("providerId");
			const providerProductKey = c.req.param("providerProductKey");

			await deletePaymentProviderProduct.invoke({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId,
					providerProductKey,
				},
			});

			return c.json({ message: "Provider product deleted" });
		}
	);
