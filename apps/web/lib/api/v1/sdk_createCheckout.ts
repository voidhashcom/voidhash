import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	sdkCheckoutResponseSchema,
	sdkCreateCheckoutBodySchema,
} from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			
			const sdkService = yield* SdkService;
			const checkout = yield* AuthSession.provide(authSession)(
				sdkService.createCheckout({
					paymentProviderConfigurationProductId:
						c.req.valid("json").paymentProviderConfigurationProductId,
					successCallbackUrl: c.req.valid("json").successCallbackUrl,
					errorCallbackUrl: c.req.valid("json").errorCallbackUrl,
				})
			);

			return c.json<z.infer<typeof sdkCheckoutResponseSchema>>({
				checkoutSessionId: checkout.checkoutSessionId,
				checkoutUrl: checkout.checkoutUrl,
			});
		}))
	);
