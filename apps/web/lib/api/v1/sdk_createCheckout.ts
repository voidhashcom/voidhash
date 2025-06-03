import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	sdkCheckoutResponseSchema,
	sdkCreateCheckoutBodySchema,
} from "./schema";
import { App } from "../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { zValidator } from "@hono/zod-validator";
import { createCheckoutSession } from "@/lib/services/sdk/actions/create-checkout";

const route = describeRoute({
	description: "Creates a new checkout session",
	operationId: "sdkCreateCheckout",
	security: [
		{
			publishableKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(sdkCheckoutResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["SDK"],
});

export type Route = typeof route;

export const registerSdkCreateCheckout = (app: App) =>
	app.post(
		"/v1/sdk/create-checkout",
		route,
		zValidator("json", sdkCreateCheckoutBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}

			const checkoutResult = await createCheckoutSession.invoke({
				ctx: authenticatedContext.value,
				input: {
					paywallProductId: c.req.valid("json").paywallProductId,
					successCallbackUrl: c.req.valid("json").successCallbackUrl,
					errorCallbackUrl: c.req.valid("json").errorCallbackUrl,
				},
			});

			if (checkoutResult.isErr()) {
				throw toVoidhashHTTPError(checkoutResult.error);
			}

			const checkout = checkoutResult.value;

			return c.json<z.infer<typeof sdkCheckoutResponseSchema>>({
				checkoutSessionId: checkout.checkoutSessionId,
				checkoutUrl: checkout.checkoutUrl,
			});
		}
	);
