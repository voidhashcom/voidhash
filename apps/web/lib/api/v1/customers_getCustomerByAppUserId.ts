import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { createEffectHandler } from "@/lib/effect/runtimes/hono";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
	app.get("/v1/customers/by-app-user-id/:appUserId", route,
		async (c) => createEffectHandler(c)(Effect.gen(function* () {
			const authService = yield* Auth;
			const authSession = yield* authService.authenticate;
			const projectId = authSession.projects[0]?.id;
			if (!projectId) {
				return yield* Effect.die(new Error("Project not found"));
			}
			const customerService = yield* CustomerService;
			const customer = yield* AuthSession.provide(authSession)(customerService.getCustomerByAppUserId(c.req.param("appUserId")));

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: customer.id,
				name: customer.name ?? null,
				email: customer.email ?? null,
				appUserId: customer.appUserId ?? null,
			});
		}))
	);
