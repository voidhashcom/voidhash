// import { describeRoute } from "hono-openapi";
// import { resolver } from "hono-openapi/zod";
// import { openApiErrorResponses } from "../../errors/openapi_responses";
// import { customerResponseSchema } from "./schema";
// import { App } from "../../hono/app";
// import { authenticateContext } from "@/lib/service-function";
// import { getCustomerByAppUserId } from "@/lib/services/customers/queries";
// import { z } from "zod";

// const route = describeRoute({
// 	description: "Get a customer by app user ID",
// 	operationId: "sdkGetCustomerByAppUserId",
// 	responses: {
// 		200: {
// 			description: "Successful response",
// 			content: {
// 				"application/json": { schema: resolver(customerResponseSchema) },
// 			},
// 		},
// 		...openApiErrorResponses,
// 	},
// 	tags: ["customers", "sdk"],
// });

// export type Route = typeof route;

// export const registerCustomersGetCustomerByAppUserId = (app: App) =>
// 	app.get("/v1/sdk/get-customer", route, async (c) => {
// 		const context = c.get("services");
// 		const authenticatedContext = await authenticateContext(context);
// 		const appUserId = c.req.param("appUserId");

// 		const customer = await getCustomerByAppUserId({
// 			ctx: authenticatedContext,
// 			input: { appUserId },
// 		});

// 		if (!customer) {
// 			return c.json({ error: "Customer not found" }, 404);
// 		}

// 		return c.json<z.infer<typeof customerResponseSchema>>({
// 			customerId: customer.id,
// 			name: customer.name ?? null,
// 			email: customer.email,
// 			appUserId: customer.appUserId ?? null,
// 			origin: customer.origin,
// 		});
// 	});
