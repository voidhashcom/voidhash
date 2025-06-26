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
	app.get("/v1/customers", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);
		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}
		const projectId = authenticatedContext.value.session?.projects[0]?.id;

		if (!projectId) {
			return c.json({ error: "Project not found" }, 404);
		}

		const runtime = createHonoRuntime(c);

		const customers = await tryCatch(
			runtime.runPromise(
				pipe(
					CustomerService,
					Effect.flatMap((customerService) =>
						customerService.getCustomers({
							projectId,
						})
					)
				)
			)
		);

		if (customers.error) {
			throw toVoidhashHTTPError(customers.error);
		}

		return c.json<z.infer<typeof customerResponseSchema>[]>(
			customers.data.map((customer) => ({
				customerId: customer.id,
				name: customer.name ?? null,
				email: customer.email,
				appUserId: customer.appUserId ?? null,
				origin: customer.origin,
			}))
		);
	});
