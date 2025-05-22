import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { createCustomerBodySchema, customerResponseSchema } from "./schema";
import { App } from "../../hono/app";
import { zValidator } from "@hono/zod-validator";
import { authenticateContext } from "@/lib/service-function";
import { createCustomer } from "@/lib/services/customers/actions/create-customer";
import { z } from "zod";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";

const route = describeRoute({
	description: "Create a new customer",
	operationId: "createCustomer",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(customerResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["customers"],
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

			const createdCustomer = await createCustomer.invoke({
				ctx: authenticatedContext.value,
				input: {
					email: c.req.valid("json").email,
					name: c.req.valid("json").name,
					appUserId: c.req.valid("json").appUserId,
					origin: "api",
					projectId,
				},
			});
			if (createdCustomer.isErr()) {
				throw toVoidhashHTTPError(createdCustomer.error);
			}

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: createdCustomer.value.id,
				name: createdCustomer.value.name ?? null,
				email: createdCustomer.value.email ?? null,
				appUserId: createdCustomer.value.appUserId ?? null,
				origin: createdCustomer.value.origin,
			});
		}
	);

export type CustomersCreateCustomerRequestBody = z.infer<
	typeof createCustomerBodySchema
>;

export type CustomersCreateCustomerResponse = z.infer<
	typeof customerResponseSchema
>;
