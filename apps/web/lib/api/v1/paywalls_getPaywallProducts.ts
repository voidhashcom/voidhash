import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	getPaywallProductsParamsSchema,
	paywallProductResponseSchema,
} from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Get all products for a paywall",
	operationId: "getPaywallProducts",
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
					schema: resolver(z.array(paywallProductResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Paywalls"],
});

export type Route = typeof route;

export const registerPaywallsGetPaywallProducts = (app: App) =>
	app.get(
		"/v1/paywalls/:paywallId/products",
		route,
		zValidator("param", getPaywallProductsParamsSchema),
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			const projectId = authSession.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.die(new Error("Project not found"));
			}
			const paywallService = yield* PaywallService;
			const paywallProducts = yield* AuthSession.provide(authSession)(paywallService.getPaywallProducts(c.req.param("paywallId")));

			return c.json<z.infer<typeof paywallProductResponseSchema>[]>(
				paywallProducts.map((pp) => ({
					paywallId: pp.paywallId,
					productId: pp.productId,
					productName: pp.product.name ?? null,
				}))
			);
		}))
	);
