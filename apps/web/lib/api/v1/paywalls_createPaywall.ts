import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createPaywallBodySchema, paywallResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywall.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";

const route = describeRoute({
	description: "Create a new paywall",
	operationId: "createPaywall",
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

export const registerPaywallsCreatePaywall = (app: App) =>
	app.post(
		"/v1/paywalls",
		route,
		zValidator("json", createPaywallBodySchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* AuthService;
					const environmentService = yield* EnvironmentService;
					const paywallService = yield* PaywallService;
					const authSession = yield* authService.authenticateWithSecretKey();
					return yield* AuthSession.provide(authSession)(
						Effect.gen(function* () {
							const environment =
								yield* environmentService.getEnvironmentFromApiAuthSession();

							const projectId = yield* authService.getAuthorizedProjectId();
							const createdPaywall = yield* Environment.provide(environment)(
								paywallService.createPaywall({
									name: c.req.valid("json").name,
									projectId,
								})
							);

							const refreshedPaywall = yield* paywallService.getPaywallById(
								createdPaywall.id
							);

							if (!refreshedPaywall) {
								// Should never happen, because the paywall was created above
								return yield* Effect.die(new Error("Paywall not found"));
							}

							return c.json<z.infer<typeof paywallResponseSchema>>({
								paywallId: refreshedPaywall.id,
								name: refreshedPaywall.name,
							});
						})
					);
				})
			)
	);
