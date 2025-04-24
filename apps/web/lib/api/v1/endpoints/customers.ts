import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { createCustomer } from "@/lib/services/customers/create-customer";
import { createServerServiceContext } from "../../utils/create-server-service-context";
import { authenticateContext } from "@/lib/service-function";
import { createCustomerBodySchema, customerResponseSchema } from "./schema";
import { z } from "zod";
import {
	getCustomerByAppUserId,
	getCustomers,
} from "@/lib/services/customers/queries";

const app = new Hono()
	.post(
		"/",
		describeRoute({
			description: "Create a new customer",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(customerResponseSchema) },
					},
				},
			},
			tags: ["customers"],
		}),
		zValidator("json", createCustomerBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdCustomer = await createCustomer({
				ctx: authenticatedContext,
				input: {
					email: c.req.valid("json").email,
					name: c.req.valid("json").name,
					appUserId: c.req.valid("json").appUserId,
					projectId,
				},
			});
			const response: z.infer<typeof customerResponseSchema> = {
				customerId: createdCustomer.id,
				name: createdCustomer.name ?? null,
				email: createdCustomer.email,
				appUserId: createdCustomer.appUserId ?? null,
			};
			return c.json(response);
		}
	)
	.get(
		"/",
		describeRoute({
			description: "List customers",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.array(customerResponseSchema)),
						},
					},
				},
			},
			tags: ["customers"],
		}),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const customers = await getCustomers({
				ctx: authenticatedContext,
				input: {
					projectId,
				},
			});

			const response: z.infer<typeof customerResponseSchema>[] = customers.map(
				(customer) => ({
					customerId: customer.id,
					name: customer.name ?? null,
					email: customer.email,
					appUserId: customer.appUserId ?? null,
				})
			);

			return c.json(response);
		}
	)
	.get(
		"/by-app-user-id/:appUserId",
		describeRoute({
			description: "Get a customer by app user ID",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(customerResponseSchema) },
					},
				},
			},
			tags: ["customers"],
		}),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const appUserId = c.req.param("appUserId");

			const customer = await getCustomerByAppUserId({
				ctx: authenticatedContext,
				input: { appUserId },
			});

			if (!customer) {
				return c.json({ error: "Customer not found" }, 404);
			}

			const response: z.infer<typeof customerResponseSchema> = {
				customerId: customer.id,
				name: customer.name ?? null,
				email: customer.email,
				appUserId: customer.appUserId ?? null,
			};

			return c.json(response);
		}
	);

export default app;
