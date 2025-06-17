import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	providerProductResponseSchema,
	updateProviderProductBodySchema,
	updateProviderProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { updatePaymentProviderProduct } from "@/lib/services/products/actions/update-payment-provider-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";
import { getProviderProductByPrimaryKey } from "@/lib/services/products/queries";

const route = describeRoute({
	description: "Update a provider product",
	operationId: "updateProviderProduct",
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

export const registerProductsUpdateProviderProduct = (app: App) =>
	app.put(
		"/v1/products/:productId/provider-products/:paymentProviderConfigurationId/:providerProductKey",
		route,
		zValidator("param", updateProviderProductParamsSchema),
		zValidator("json", updateProviderProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const productId = c.req.param("productId");
			const paymentProviderConfigurationId = c.req.param(
				"paymentProviderConfigurationId"
			);
			const providerProductKey = c.req.param("providerProductKey");
			const configuration = c.req.valid("json");

			const projectId = authenticatedContext.value.session?.projects[0]?.id;
			if (!projectId) {
				throw new VoidhashHTTPError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const updatedProviderProduct = await updatePaymentProviderProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					productId,
					paymentProviderConfigurationId: paymentProviderConfigurationId,
					configuration: configuration.configuration,
					providerProductKey,
				},
			});

			if (updatedProviderProduct.isErr()) {
				throw toVoidhashHTTPError(updatedProviderProduct.error);
			}

			const providerProduct = await getProviderProductByPrimaryKey({
				ctx: authenticatedContext.value,
				input: {
					paymentProviderConfigurationId: paymentProviderConfigurationId,
					productProviderKey: providerProductKey,
				},
			});

			if (providerProduct.isErr()) {
				throw toVoidhashHTTPError(providerProduct.error);
			}

			const responseBody: z.infer<typeof providerProductResponseSchema> = {
				providerProductKey: providerProduct.value.providerProductKey,
				providerConfiguration: {
					configuration: providerProduct.value.configuration,
					providerId: providerProduct.value.providerId,
				},
			};

			return c.json(responseBody);
		}
	);

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
