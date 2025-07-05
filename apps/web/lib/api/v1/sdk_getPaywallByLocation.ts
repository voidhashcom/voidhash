import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	sdkGetPaywallByLocationParamsSchema,
	sdkPaywallResponseSchema,
} from "./schema";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { SdkService } from "@/lib/services/sdk.service";
import { Effect } from "effect";
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
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const sdkService = yield* SdkService;
					const paywall = yield* AuthSession.provide(authSession)(
						sdkService
							.getPaywallByLocation({
								locationSlug: c.req.param("locationSlug"),
								nativePaymentProviderId: undefined, // You may need to get this from query params if needed
							})
							.pipe(
								Effect.catchTags({
									PaywallNotFound: (error) =>
										Effect.fail(
											new HonoErrorResponse({
												code: "NOT_FOUND",
												message: error.message,
												originalError: error,
											})
										),
								})
							)
					);

					return c.json<z.infer<typeof sdkPaywallResponseSchema>>(paywall);
				})
			)
	);
