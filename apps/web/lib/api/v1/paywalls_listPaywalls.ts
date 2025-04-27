import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { paywallResponseSchema } from "./schema";
import { getPaywalls } from "@/lib/services/paywalls/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "List paywalls",
	operationId: "listPaywalls",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.array(paywallResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls"],
});

export type Route = typeof route;

export const registerPaywallsListPaywalls = (app: App) =>
	app.get("/v1/paywalls", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);
		const projectId = authenticatedContext.session?.projects[0]?.id;

		if (!projectId) {
			return c.json({ error: "Project not found" }, 404);
		}

		const paywalls = await getPaywalls({
			ctx: authenticatedContext,
			input: {
				projectId,
			},
		});

		const response: z.infer<typeof paywallResponseSchema>[] = paywalls.map(
			(paywall) => ({
				paywallId: paywall.id,
				name: paywall.name,
				projectId: paywall.projectId,
			})
		);

		return c.json(response);
	});
