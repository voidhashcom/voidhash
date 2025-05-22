import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { getCustomers } from "@/lib/services/customers/queries";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

const route = describeRoute({
	description: "List customers",
	operationId: "listCustomers",
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
	tags: ["customers"],
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

		const customers = await getCustomers({
			ctx: authenticatedContext.value,
			input: {
				projectId,
			},
		});

		if (customers.isErr()) {
			throw toVoidhashHTTPError(customers.error);
		}

		return c.json<z.infer<typeof customerResponseSchema>[]>(
			customers.value.map((customer) => ({
				customerId: customer.id,
				name: customer.name ?? null,
				email: customer.email,
				appUserId: customer.appUserId ?? null,
				origin: customer.origin,
			}))
		);
	});
