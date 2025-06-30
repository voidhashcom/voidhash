import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { paywallResponseSchema } from "./schema";
import { App } from "../hono/app";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { pipe, Effect } from "effect";
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
	app.get("/v1/paywalls", route, async (c) => {
		const runtime = createHonoRuntime(c);
		const result = await tryCatch(
			runtime.runPromise(Effect.gen(function* () {
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate;
				const projectId = authSession.projects[0]?.id;
				if (!projectId) {
					return yield* Effect.die(new Error("Project not found"));
				}
				
				return yield* AuthSession.provide(authSession)(pipe(
					PaywallService,
					Effect.flatMap((paywallService) =>
						paywallService.getPaywalls(projectId)
					)
				))
			}))
		);

		if (result.error) {
			throw toVoidhashHTTPError(result.error);
		}

		return c.json<z.infer<typeof paywallResponseSchema>[]>(
			result.data.map((paywall) => ({
				paywallId: paywall.id,
				name: paywall.name,
				projectId: paywall.projectId,
			}))
		);
	});
