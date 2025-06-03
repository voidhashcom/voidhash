import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	sdkGetPaywallByLocationParamsSchema,
	sdkPaywallResponseSchema,
} from "./schema";
import { authenticateContext } from "@/lib/service-function";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { sdkGetPaywallByLocation } from "@/lib/services/sdk/actions/get-paywall-by-location";
import { z } from "zod";

const route = describeRoute({
	description: "Get paywall by location",
	operationId: "sdkGetPaywallByLocation",
	security: [
		{
			publishableKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(sdkPaywallResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["SDK"],
});

export type Route = typeof route;

export const registerSdkGetPaywallByLocation = (app: App) =>
	app.get(
		"/v1/sdk/get-paywall-by-location/:locationSlug",
		route,
		zValidator("param", sdkGetPaywallByLocationParamsSchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}

			const paywallResult = await sdkGetPaywallByLocation.invoke({
				ctx: authenticatedContext.value,
				input: {
					locationSlug: c.req.param("locationSlug"),
				},
			});

			if (paywallResult.isErr()) {
				throw toVoidhashHTTPError(paywallResult.error);
			}

			return c.json<z.infer<typeof sdkPaywallResponseSchema>>(
				paywallResult.value
			);
		}
	);
