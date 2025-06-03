import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	customerResponseSchema,
	sdkCustomerResponseSchema,
	sdkIdentifyCustomerBodySchema,
} from "./schema";
import { App } from "../hono/app";
import { authenticateContext } from "@/lib/service-function";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { zValidator } from "@hono/zod-validator";
import { identifyCustomer } from "@/lib/services/sdk/actions/identify-customer";

const route = describeRoute({
	description:
		"Identifies a customer. If the customer does not exist, it will be created.",
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

export const registerSdkIdentify = (app: App) =>
	app.post(
		"/v1/sdk/identify",
		route,
		zValidator("json", sdkIdentifyCustomerBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);

			if (authenticatedContext.isErr()) {
				throw toVoidhashHTTPError(authenticatedContext.error);
			}

			console.log(c.req.valid("json"));

			const customerResultResult = await identifyCustomer.invoke({
				ctx: authenticatedContext.value,
				input: {
					appUserId: c.req.valid("json").appUserId,
					name: c.req.valid("json").name,
					email: c.req.valid("json").email,
				},
			});

			if (customerResultResult.isErr()) {
				throw toVoidhashHTTPError(customerResultResult.error);
			}

			const customer = customerResultResult.value;
			console.log(customer);

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: customer.id,
				name: customer.name ?? null,
				email: customer.email,
				appUserId: customer.appUserId ?? null,
				// origin: customer.origin,
			});
		}
	);
