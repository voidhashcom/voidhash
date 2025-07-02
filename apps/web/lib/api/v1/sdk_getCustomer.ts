import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema, sdkCustomerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import {
	createEffectHandler,
	HonoErrorResponse,
} from "@/lib/effect/runtimes/hono";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Get a customer by app user ID",
	operationId: "sdkGetCustomerByAppUserId",
	security: [
		{
			publishableKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(sdkCustomerResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["SDK"],
});

export type Route = typeof route;

export const registerSdkGetCustomer = (app: App) =>
	app.get("/v1/sdk/get-customer", route, async (c) =>
		createEffectHandler(c)(
			Effect.gen(function* () {
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate();
				const sdkService = yield* SdkService;
				const customer = yield* AuthSession.provide(authSession)(
					sdkService.getCustomerOrCreateAnonymous()
				);

				if (!customer) {
					return yield* Effect.fail(
						new HonoErrorResponse({
							code: "NOT_FOUND",
							message: "Customer not found",
						})
					);
				}

				return c.json<z.infer<typeof customerResponseSchema>>({
					customerId: customer.id,
					name: customer.name ?? null,
					email: customer.email,
					appUserId: customer.appUserId ?? null,
					// origin: customer.origin,
				});
			})
		)
	);
