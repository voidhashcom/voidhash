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
import { Auth, AuthSession } from "@/lib/effect/auth";

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
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const paywallService = yield* PaywallService;
					yield* AuthSession.provide(authSession)(
						paywallService.deletePaywall({
							paywallId: c.req.param("paywallId"),
						})
					).pipe(
						Effect.catchTags({
							PaywallNotFound: (error) =>
								Effect.fail(
									new HonoErrorResponse({
										code: "NOT_FOUND",
										message: error.message,
										originalError: error,
									})
								),
							PaywallInUseError: (error) =>
								Effect.fail(
									new HonoErrorResponse({
										code: "BAD_REQUEST",
										message: error.message,
										originalError: error,
									})
								),
						})
					);

					return c.json({ message: "Paywall deleted" });
				})
			)
	);
