import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	sdkGetPaywallByLocationParamsSchema,
	sdkPaywallResponseSchema,
} from "./schema";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
			const runtime = createHonoRuntime(c);
			
			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						SdkService,
						Effect.flatMap((sdkService) =>
							sdkService.getPaywallByLocation({
								locationSlug: c.req.param("locationSlug"),
								nativePaymentProviderId: undefined, // You may need to get this from query params if needed
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json<z.infer<typeof sdkPaywallResponseSchema>>(result.data);
		}
	);
