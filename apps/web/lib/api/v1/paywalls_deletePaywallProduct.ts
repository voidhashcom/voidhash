import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { deletePaywallProductParamsSchema } from "./schema";
import { deletePaywallProduct } from "@/lib/services/paywalls/delete-paywall-product";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "Remove a product from a paywall",
	operationId: "deletePaywallProduct",
	responses: {
		200: {
			description: "Successful response",
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsDeletePaywallProduct = (app: App) =>
	app.delete(
		"/v1/paywalls/:paywallId/products/:productId",
		route,
		zValidator("param", deletePaywallProductParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");
			const productId = c.req.param("productId");

			await deletePaywallProduct.invoke({
				ctx: authenticatedContext,
				input: {
					paywallId,
					productId,
				},
			});

			return c.json({ message: "Product removed from paywall" });
		}
	);
