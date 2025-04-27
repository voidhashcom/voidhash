// import { Hono } from "hono";
// import { describeRoute } from "hono-openapi";
// import { resolver, validator as zValidator } from "hono-openapi/zod";
// import { createCustomer } from "@/lib/services/customers/create-customer";
// import { createServerServiceContext } from "../../utils/create-server-service-context";
// import { authenticateContext } from "@/lib/service-function";
// import { createCustomerBodySchema, customerResponseSchema } from "./schema";
// import { z } from "zod";
// import {
// 	getCustomerByAppUserId,
// 	getCustomers,
// } from "@/lib/services/customers/queries";
// import { openApiErrorResponses } from "../../errors/openapi_responses";

// const app = new Hono()

// 	.get(
// 		"/",
// 		describeRoute({
// 			description: "List customers",
// 			operationId: "listCustomers",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(z.array(customerResponseSchema)),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["customers"],
// 		}),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const projectId = authenticatedContext.session?.projects[0]?.id;

// 			if (!projectId) {
// 				return c.json({ error: "Project not found" }, 404);
// 			}

// 			const customers = await getCustomers({
// 				ctx: authenticatedContext,
// 				input: {
// 					projectId,
// 				},
// 			});

// 			return c.json<z.infer<typeof customerResponseSchema>[]>(
// 				customers.map((customer) => ({
// 					customerId: customer.id,
// 					name: customer.name ?? null,
// 					email: customer.email,
// 					appUserId: customer.appUserId ?? null,
// 				}))
// 			);
// 		}
// 	)
// 	.get(
// 		"/by-app-user-id/:appUserId",
// 		describeRoute({
// 			description: "Get a customer by app user ID",
// 			operationId: "getCustomerByAppUserId",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": { schema: resolver(customerResponseSchema) },
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["customers"],
// 		}),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const appUserId = c.req.param("appUserId");

// 			const customer = await getCustomerByAppUserId({
// 				ctx: authenticatedContext,
// 				input: { appUserId },
// 			});

// 			if (!customer) {
// 				return c.json({ error: "Customer not found" }, 404);
// 			}

// 			return c.json<z.infer<typeof customerResponseSchema>>({
// 				customerId: customer.id,
// 				name: customer.name ?? null,
// 				email: customer.email,
// 				appUserId: customer.appUserId ?? null,
// 			});
// 		}
// 	);

// export default app;
