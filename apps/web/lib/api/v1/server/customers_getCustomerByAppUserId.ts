import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { customerResponseSchema } from "./schema";
import { App } from "../../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { getCustomerByAppUserId } from "@/lib/services/customers/queries";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";

const route = describeRoute({
	description: "Get a customer by app user ID",
	operationId: "getCustomerByAppUserId",
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

export const registerCustomersGetCustomerByAppUserId = (app: App) =>
	app.get("/v1/customers/by-app-user-id/:appUserId", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);
		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}
		const appUserId = c.req.param("appUserId");

		const customer = await getCustomerByAppUserId({
			ctx: authenticatedContext.value,
			input: { appUserId },
		});

		if (customer.isErr()) {
			throw toVoidhashHTTPError(customer.error);
		}

		return c.json<z.infer<typeof customerResponseSchema>>({
			customerId: customer.value.id,
			name: customer.value.name ?? null,
			email: customer.value.email,
			appUserId: customer.value.appUserId ?? null,
			origin: customer.value.origin,
		});
	});
