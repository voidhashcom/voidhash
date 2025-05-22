import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";
import {
	sdkGetPaywallByLocationParamsSchema,
	sdkPaywallResponseSchema,
} from "./schema";

const route = describeRoute({
	description: "Get paywall by location",
	operationId: "sdkGetPaywallByLocation",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(sdkPaywallResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["paywalls", "sdk"],
});

export type Route = typeof route;

export const registerPaywallsGetPaywallByLocation = (app: App) =>
	app.get(
		"/v1/sdk/get-paywall-by-location",
		route,
		zValidator("param", sdkGetPaywallByLocationParamsSchema),
		async () => {
			// const context = c.get("services");
			// const authenticatedContext = await authenticateContext(context);
			// const paywallId = c.req.param("paywallId");
			// const paywall = await getPaywallById({
			// 	ctx: authenticatedContext,
			// 	input: {
			// 		id: paywallId,
			// 	},
			// });
			// if (!paywall) {
			// 	return c.json({ error: "Paywall not found" }, 404);
			// }
			// const response: z.infer<typeof sdkPaywallResponseSchema> = {
			// 	paywallId: paywall.id,
			// 	name: paywall.name,
			// };
			// return c.json(response);
		}
	);
