import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { deletePaywallParamsSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import {
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywall.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

const route = describeRoute({
	description: "Delete a paywall",
	operationId: "deletePaywall",
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
					schema: resolver(z.object({ message: z.string() })),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Paywalls"],
});

export type Route = typeof route;

export const registerPaywallsDeletePaywall = (app: App) =>
	app.delete(
		"/v1/paywalls/:paywallId",
		route,
		zValidator("param", deletePaywallParamsSchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const paywallService = yield* PaywallService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							yield* paywallService.deletePaywall({
								paywallId: c.req.param("paywallId"),
							});
							return c.json({ message: "Paywall deleted" });
						}),
					).pipe(
						Effect.catchTags({
							PaywallNotFoundError: (error) =>
								Effect.fail(
									new HonoErrorResponse({
										code: "NOT_FOUND",
										message: error.message,
										originalError: error,
									}),
								),
							PaywallInUseError: (error) =>
								Effect.fail(
									new HonoErrorResponse({
										code: "BAD_REQUEST",
										message: error.message,
										originalError: error,
									}),
								),
						}),
					);
				}),
			),
	);
