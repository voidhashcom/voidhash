import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { createPaywallBodySchema, paywallResponseSchema } from "./schema";
import { createPaywall } from "@/lib/services/paywalls/actions/create-paywall";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Create a new paywall",
	operationId: "createPaywall",
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

export const registerPaywallsCreatePaywall = (app: App) =>
	app.post(
		"/v1/paywalls",
		route,
		zValidator("json", createPaywallBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdPaywall = await createPaywall.invoke({
				ctx: authenticatedContext,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});
			const response: z.infer<typeof paywallResponseSchema> = {
				paywallId: createdPaywall.id,
				name: createdPaywall.name,
			};
			return c.json(response);
		}
	);
