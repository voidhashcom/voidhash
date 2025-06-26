import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createCustomerBodySchema, customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { authenticateContext } from "@/lib/service-function";
import { z } from "zod";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { CustomerService } from "@/lib/services/customers/customer-service";
import { pipe, Effect } from "effect";

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
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}
			const projectId = authenticatedContext.value.session?.projects[0]?.id;

			if (!projectId) {
				throw new VoidhashHTTPError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const runtime = createHonoRuntime(c);
			const createdCusomer = await tryCatch(
				runtime.runPromise(
					pipe(
						CustomerService,
						Effect.flatMap((customerService) =>
							customerService.createCustomer({
								email: c.req.valid("json").email,
								name: c.req.valid("json").name,
								appUserId: c.req.valid("json").appUserId,
								origin: "api",
								projectId,
							})
						)
					)
				)
			);

			if (createdCusomer.error) {
				throw toVoidhashHTTPError(createdCusomer.error);
			}

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: createdCusomer.data.id,
				name: createdCusomer.data.name ?? null,
				email: createdCusomer.data.email ?? null,
				appUserId: createdCusomer.data.appUserId ?? null,
				// origin: createdCusomer.data.origin,
			});
		}
	);

export type CustomersCreateCustomerRequestBody = z.infer<
	typeof createCustomerBodySchema
>;

export type CustomersCreateCustomerResponse = z.infer<
	typeof customerResponseSchema
>;
