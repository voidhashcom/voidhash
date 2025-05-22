import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import { deletePaywallProductParamsSchema } from "./schema";
import { deletePaywallProduct } from "@/lib/services/paywalls/actions/delete-paywall-product";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

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
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const paywallId = c.req.param("paywallId");
			const productId = c.req.param("productId");

			const deletedPaywallProduct = await deletePaywallProduct.invoke({
				ctx: authenticatedContext.value,
				input: {
					paywallId,
					productId,
				},
			});

			if (deletedPaywallProduct.isErr()) {
				throw toVoidhashHTTPError(deletedPaywallProduct.error);
			}

			return c.json({ message: "Product removed from paywall" });
		}
	);
