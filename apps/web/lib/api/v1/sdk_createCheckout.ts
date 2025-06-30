import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	sdkCheckoutResponseSchema,
	sdkCreateCheckoutBodySchema,
} from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { zValidator } from "@hono/zod-validator";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { pipe, Effect } from "effect";
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
		async (c) => {
			const runtime = createHonoRuntime(c);
			
			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						SdkService,
						Effect.flatMap((sdkService) =>
							sdkService.createCheckout({
								paymentProviderConfigurationProductId:
									c.req.valid("json").paymentProviderConfigurationProductId,
								successCallbackUrl: c.req.valid("json").successCallbackUrl,
								errorCallbackUrl: c.req.valid("json").errorCallbackUrl,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json<z.infer<typeof sdkCheckoutResponseSchema>>({
				checkoutSessionId: result.data.checkoutSessionId,
				checkoutUrl: result.data.checkoutUrl,
			});
		}
	);
