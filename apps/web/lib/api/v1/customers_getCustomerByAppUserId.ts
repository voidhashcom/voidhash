import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { CustomerService } from "@/lib/services/customers/customer-service";
import { Effect, pipe } from "effect";

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
	app.get("/v1/customers/by-app-user-id/:appUserId", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);
		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}
		const appUserId = c.req.param("appUserId");

		const runtime = createHonoRuntime(c);
		const customer = await tryCatch(
			runtime.runPromise(
				pipe(
					CustomerService,
					Effect.flatMap((customerService) =>
						customerService.getCustomerByAppUserId(appUserId)
					)
				)
			)
		);

		if (customer.error) {
			throw toVoidhashHTTPError(customer.error);
		}

		return c.json<z.infer<typeof customerResponseSchema>>({
			customerId: customer.data.id,
			name: customer.data.name ?? null,
			email: customer.data.email,
			appUserId: customer.data.appUserId ?? null,
			// origin: customer.value.origin,
		});
	});
