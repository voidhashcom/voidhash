import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createCustomerBodySchema, customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

const route = describeRoute({
	description: "Create a new customer",
	operationId: "createCustomer",
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

export const registerCustomersCreateCustomer = (app: App) =>
	app.post(
		"/v1/customers",
		route,
		zValidator("json", createCustomerBodySchema),
		async (c) =>
			createEffectHandler(c)(
				Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate();
					const customerService = yield* CustomerService;
					const projectId = yield* AuthSession.provide(authSession)(
						authService.getAuthorizedProjectId()
					);
					const customer = yield* AuthSession.provide(authSession)(
						customerService.createCustomer({
							email: c.req.valid("json").email,
							name: c.req.valid("json").name,
							appUserId: c.req.valid("json").appUserId,
							origin: "api",
							projectId,
						})
					);

					return c.json<z.infer<typeof customerResponseSchema>>({
						customerId: customer.id,
						name: customer.name ?? null,
						email: customer.email ?? null,
						appUserId: customer.appUserId ?? null,
					});
				})
			)
	);

export type CustomersCreateCustomerRequestBody = z.infer<
	typeof createCustomerBodySchema
>;

export type CustomersCreateCustomerResponse = z.infer<
	typeof customerResponseSchema
>;
