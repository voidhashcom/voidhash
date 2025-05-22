import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import {
	attachProductToPaywallBodySchema,
	attachProductToPaywallParamsSchema,
	paywallProductResponseSchema,
} from "./schema";
import { createPaywallProduct } from "@/lib/services/paywalls/actions/create-paywall-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

const route = describeRoute({
	description: "Attach a product to a paywall",
	operationId: "attachProductToPaywall",
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
					schema: resolver(paywallProductResponseSchema),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsAttachProductToPaywall = (app: App) =>
	app.post(
		"/v1/paywalls/:paywallId/products",
		route,
		zValidator("param", attachProductToPaywallParamsSchema),
		zValidator("json", attachProductToPaywallBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const paywallId = c.req.param("paywallId");
			const productId = c.req.valid("json").productId;

			const paywallProduct = await createPaywallProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					paywallId,
					productId,
				},
			});

			if (paywallProduct.isErr()) {
				throw toVoidhashHTTPError(paywallProduct.error);
			}

			// TODO: createPaywallProduct returns { paywallId, productId }, but the query for productName is separate.
			// We'll return what we have for now.

			return c.json<z.infer<typeof paywallProductResponseSchema>>({
				paywallId: paywallProduct.value.paywallId,
				productId: paywallProduct.value.productId,
				productName: null, // productName is not directly available here
			});
		}
	);
