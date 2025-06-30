import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createPaywallBodySchema, paywallResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			const projectId = authSession.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.die(new Error("Project not found"));
			}
			const paywallService = yield* PaywallService;
			const createdPaywall = yield* AuthSession.provide(authSession)(paywallService.createPaywall({
				name: c.req.valid("json").name,
				projectId,
			}));

			const refreshedPaywall = yield* AuthSession.provide(authSession)(paywallService.getPaywallById(createdPaywall.id));
			if (!refreshedPaywall) {
				return yield* Effect.die(new Error("Paywall not found"));
			}

			return c.json<z.infer<typeof paywallResponseSchema>>({
				paywallId: refreshedPaywall.id,
				name: refreshedPaywall.name,
			});
		}))
	);
