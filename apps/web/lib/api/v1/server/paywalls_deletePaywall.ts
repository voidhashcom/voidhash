import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { deletePaywallParamsSchema } from "./schema";
import { deletePaywall } from "@/lib/services/paywalls/actions/delete-paywall";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Delete a paywall",
	operationId: "deletePaywall",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.object({ message: z.string() })),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsDeletePaywall = (app: App) =>
	app.delete(
		"/v1/paywalls/:paywallId",
		route,
		zValidator("param", deletePaywallParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			await deletePaywall.invoke({
				ctx: authenticatedContext,
				input: {
					paywallId,
				},
			});

			return c.json({ message: "Paywall deleted" });
		}
	);
