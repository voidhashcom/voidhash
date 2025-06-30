import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { getPaywallByIdParamsSchema, paywallResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { createEffectHandler, HonoErrorResponse } from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			const projectId = authSession.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.die(new Error("Project not found"));
			}
			const paywallService = yield* PaywallService;
			const paywall = yield* AuthSession.provide(authSession)(paywallService.getPaywallById(c.req.param("paywallId")));

			if (!paywall) {
				return yield* Effect.die(new HonoErrorResponse({
					code: "NOT_FOUND",
					message: "Paywall not found",
				}));
			}

			return c.json<z.infer<typeof paywallResponseSchema>>({
				paywallId: paywall.id,
				name: paywall.name,
			});
		}))
	);