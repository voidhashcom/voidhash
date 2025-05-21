import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { authenticateContext } from "@/lib/service-function";
import { createPaywallBodySchema, paywallResponseSchema } from "./schema";
import { createPaywall } from "@/lib/services/paywalls/actions/create-paywall";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";
import { getPaywallById } from "@/lib/services/paywalls/queries";

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

			const createdPaywall = await createPaywall.invoke({
				ctx: authenticatedContext.value,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});
			if (createdPaywall.isErr()) {
				throw toVoidhashHTTPError(createdPaywall.error);
			}

			const paywall = await getPaywallById({
				ctx: authenticatedContext.value,
				input: {
					id: createdPaywall.value.id,
				},
			});
			if (paywall.isErr()) {
				throw toVoidhashHTTPError(paywall.error);
			}

			const response: z.infer<typeof paywallResponseSchema> = {
				paywallId: paywall.value.id,
				name: paywall.value.name,
			};
			return c.json(response);
		}
	);
