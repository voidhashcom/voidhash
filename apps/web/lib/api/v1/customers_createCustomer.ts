import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { createCustomerBodySchema, customerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { zValidator } from "@hono/zod-validator";
import { authenticateContext } from "@/lib/service-function";
import { createCustomer } from "@/lib/services/customers/create-customer";
import { z } from "zod";

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
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdCustomer = await createCustomer.invoke({
				ctx: authenticatedContext,
				input: {
					email: c.req.valid("json").email,
					name: c.req.valid("json").name,
					appUserId: c.req.valid("json").appUserId,
					origin: "api",
					projectId,
				},
			});

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: createdCustomer.id,
				name: createdCustomer.name ?? null,
				email: createdCustomer.email ?? null,
				origin: createdCustomer.origin,
				appUserId: createdCustomer.appUserId ?? null,
			});
		}
	);

export type CustomersCreateCustomerRequestBody = z.infer<
	typeof createCustomerBodySchema
>;

export type CustomersCreateCustomerResponse = z.infer<
	typeof customerResponseSchema
>;
