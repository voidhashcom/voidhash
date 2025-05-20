import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { getPaywallByIdParamsSchema, paywallResponseSchema } from "./schema";
import { getPaywallById } from "@/lib/services/paywalls/queries";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Get a paywall",
	operationId: "getPaywallById",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(paywallResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsGetPaywallById = (app: App) =>
	app.get(
		"/v1/paywalls/:paywallId",
		route,
		zValidator("param", getPaywallByIdParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			const paywall = await getPaywallById({
				ctx: authenticatedContext,
				input: {
					id: paywallId,
				},
			});

			if (!paywall) {
				return c.json({ error: "Paywall not found" }, 404);
			}

			const response: z.infer<typeof paywallResponseSchema> = {
				paywallId: paywall.id,
				name: paywall.name,
			};

			return c.json(response);
		}
	);
