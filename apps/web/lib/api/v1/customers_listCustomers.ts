import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { CustomerService } from "@/lib/services/customer.service";
import { Effect, pipe } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
				const authService = yield* Auth;
				const authSession = yield* authService.authenticate();
				const projectId = yield* AuthSession.provide(authSession)(
					authService.getAuthorizedProjectId()
				);
				const customers = yield* AuthSession.provide(authSession)(
					pipe(
						CustomerService,
						Effect.flatMap((customerService) =>
							customerService.getCustomers({
								projectId,
							})
						)
					)
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
		)
	);
