import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { getPaywallByIdParamsSchema, paywallResponseSchema } from "./schema";
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
	description: "Get a paywall",
	operationId: "getPaywallById",
	security: [
		{
			secretKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(paywallResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Paywalls"],
});

export type Route = typeof route;

export const registerPaywallsGetPaywallById = (app: App) =>
	app.get(
		"/v1/paywalls/:paywallId",
		route,
		zValidator("param", getPaywallByIdParamsSchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							console.log("getPaywallById 2");
							const paywallService = yield* PaywallService;
							const paywall = yield* paywallService.getPaywallById(
								c.req.param("paywallId")
							);
							if (!paywall) {
								return yield* Effect.fail(
									new HonoErrorResponse({
										code: "NOT_FOUND",
										message: "Paywall not found",
									})
								);
							}

							return c.json<z.infer<typeof paywallResponseSchema>>({
								paywallId: paywall.id,
								name: paywall.name,
							});
						})
					);
				})
			)
	);
