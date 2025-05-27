import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { paywallResponseSchema } from "./schema";
import { getPaywalls } from "@/lib/services/paywalls/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";

const route = describeRoute({
	description: "List paywalls",
	operationId: "listPaywalls",
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
					schema: resolver(z.array(paywallResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Paywalls"],
});

export type Route = typeof route;

export const registerPaywallsListPaywalls = (app: App) =>
	app.get("/v1/paywalls", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);

		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}

		const projectId = authenticatedContext.value.session?.projects[0]?.id;

		if (!projectId) {
			throw new VoidhashHTTPError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const paywalls = await getPaywalls({
			ctx: authenticatedContext.value,
			input: {
				projectId,
			},
		});

		if (paywalls.isErr()) {
			throw toVoidhashHTTPError(paywalls.error);
		}

		const response: z.infer<typeof paywallResponseSchema>[] =
			paywalls.value.map((paywall) => ({
				paywallId: paywall.id,
				name: paywall.name,
				projectId: paywall.projectId,
			}));

		return c.json(response);
	});
