import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { paywallResponseSchema } from "./schema";
import { App } from "../hono/app";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywall.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "List paywalls",
	operationId: "listPaywalls",
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
					schema: resolver(z.array(paywallResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Paywalls"],
});

export type Route = typeof route;

export const registerPaywallsListPaywalls = (app: App) =>
	app.get("/v1/paywalls", route, async (c) =>
		createEffectHandler(c)(
			Effect.gen(function* () {
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate();
				const paywallService = yield* PaywallService;
				const projectId = yield* AuthSession.provide(authSession)(
					authService.getAuthorizedProjectId()
				);
				const paywalls = yield* AuthSession.provide(authSession)(
					paywallService.getPaywalls(projectId)
				);

				return c.json<z.infer<typeof paywallResponseSchema>[]>(
					paywalls.map((paywall) => ({
						paywallId: paywall.id,
						name: paywall.name,
						projectId: paywall.projectId,
					}))
				);
			})
		)
	);
