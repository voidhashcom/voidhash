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

const route = describeRoute({
	description: "List customers",
	operationId: "listCustomers",
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
					schema: resolver(z.array(customerResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["Customers"],
});

export type Route = typeof route;

export const registerCustomersListCustomers = (app: App) =>
	app.get("/v1/customers", route, async (c) =>
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
						const projectId = yield* authService.getAuthorizedProjectId();
						const customers = yield* Environment.provide(environment)(
							customerService.getCustomers({
								projectId,
							})
						);

						return c.json<z.infer<typeof customerResponseSchema>[]>(
							customers.map((customer) => ({
								customerId: customer.id,
								name: customer.name ?? null,
								email: customer.email,
								appUserId: customer.appUserId ?? null,
								origin: customer.origin,
							}))
						);
					})
				);
			})
		)
	);
