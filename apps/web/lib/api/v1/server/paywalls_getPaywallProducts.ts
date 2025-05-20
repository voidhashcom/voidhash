import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import {
	getPaywallProductsParamsSchema,
	paywallProductResponseSchema,
} from "./schema";
import { getPaywallProducts } from "@/lib/services/paywalls/queries";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Get all products for a paywall",
	operationId: "getPaywallProducts",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.array(paywallProductResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsGetPaywallProducts = (app: App) =>
	app.get(
		"/v1/paywalls/:paywallId/products",
		route,
		zValidator("param", getPaywallProductsParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			const paywallProducts = await getPaywallProducts({
				ctx: authenticatedContext,
				input: {
					paywallId,
				},
			});

			return c.json<z.infer<typeof paywallProductResponseSchema>[]>(
				paywallProducts.map((pp) => ({
					paywallId: pp.paywallId,
					productId: pp.productId,
					productName: pp.product.name ?? null,
				}))
			);
		}
	);
