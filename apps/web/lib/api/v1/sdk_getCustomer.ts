import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { customerResponseSchema, sdkCustomerResponseSchema } from "./schema";
import { App } from "../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { sdkGetCustomerOrCreateAnonymous } from "@/lib/services/sdk/actions/get-customer-or-create-anonymous";

const route = describeRoute({
	description: "Get a customer by app user ID",
	operationId: "sdkGetCustomerByAppUserId",
	security: [
		{
			publishableKey: [],
		},
	],
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": { schema: resolver(sdkCustomerResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["SDK"],
});

export type Route = typeof route;

export const registerSdkGetCustomer = (app: App) =>
	app.get("/v1/sdk/get-customer", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);

		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}

		const customerResultResult = await sdkGetCustomerOrCreateAnonymous.invoke({
			ctx: authenticatedContext.value,
		});

		if (customerResultResult.isErr()) {
			throw customerResultResult.error;
		}

		const customer = customerResultResult.value;

		return c.json<z.infer<typeof customerResponseSchema>>({
			customerId: customer.id,
			name: customer.name ?? null,
			email: customer.email,
			appUserId: customer.appUserId ?? null,
			// origin: customer.origin,
		});
	});
