import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import {
	createCustomer,
	createCustomerInputSchema,
} from "@/lib/services/customers/create-customer";
import { createServerServiceContext } from "../../utils/create-server-service-context";
import { authenticateContext } from "@/lib/service-function";
import { errorResponseSchema } from "../../schema";
import { useServiceFunction } from "../../utils/execute-service-function";

const identifyResponseSchema = z.object({
	customerId: z.string(),
	name: z.string(),
	email: z.string(),
});

const createCustomerBodySchema = createCustomerInputSchema.pick({
	email: true,
	name: true,
});
const app = new Hono().post(
	"/",
	describeRoute({
		description: "Create a new customer",
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": { schema: resolver(identifyResponseSchema) },
				},
			},
			404: {
				description: "Project not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", createCustomerBodySchema),
	async (c) => {
		const context = await createServerServiceContext(c);
		const authenticatedContext = await authenticateContext(context);
		const projectId = authenticatedContext.session?.projects[0]?.id;

		if (!projectId) {
			return c.json({ error: "Project not found" }, 404);
		}
		return useServiceFunction(c, async () => {
			return await createCustomer({
				ctx: authenticatedContext,
				input: {
					email: c.req.valid("json").email,
					name: c.req.valid("json").name,
					projectId,
				},
			});
		});
	}
);

export default app;
