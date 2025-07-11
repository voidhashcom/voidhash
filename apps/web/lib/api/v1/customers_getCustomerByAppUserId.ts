import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { CustomerService } from "@/lib/services/customer.service";
import { Effect } from "effect";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";
import { NotFoundError } from "@/lib/effect/errors";

const route = describeRoute({
	description: "Get a customer by app user ID",
	operationId: "getCustomerByAppUserId",
	security: [
		{
			secretKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(customerResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Customers"],
});

export type Route = typeof route;

export const registerCustomersGetCustomerByAppUserId = (app: App) =>
	app.get("/v1/customers/by-app-user-id/:appUserId", route, async (c) =>
		createEffectHandler(c)(
			Effect.gen(function* () {
				const authService = yield* AuthService;
				const customerService = yield* CustomerService;
				const environmentService = yield* EnvironmentService;
				const authSession = yield* authService.authenticateWithSecretKey();
				return yield* AuthSession.provide(authSession)(
					Effect.gen(function* () {
						const environment =
							yield* environmentService.getEnvironmentFromApiAuthSession();

						const customer = yield* Environment.provide(environment)(
							customerService.getCustomerByAppUserId(c.req.param("appUserId")),
						).pipe(
							Effect.catchTags({
								CustomerNotFoundError: (error) =>
									Effect.fail(new NotFoundError({ message: error.message })),
							}),
						);

						return c.json<z.infer<typeof customerResponseSchema>>({
							customerId: customer.id,
							name: customer.name ?? null,
							email: customer.email ?? null,
							appUserId: customer.appUserId ?? null,
						});
					}),
				);
			}),
		),
	);
