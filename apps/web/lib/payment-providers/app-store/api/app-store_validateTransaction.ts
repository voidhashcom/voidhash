// import { describeRoute } from "hono-openapi";
// import { resolver } from "hono-openapi/zod";
// import { openApiErrorResponses } from "../errors/openapi_responses";
// import {
// 	customerResponseSchema,
// 	sdkCustomerResponseSchema,
// 	sdkIdentifyCustomerBodySchema,
// } from "./schema";
// import { App } from "../hono/app";
// import { authenticateContext } from "@/lib/service-function";
// import { z } from "zod";
// import { toVoidhashHTTPError } from "@voidhash/lib/constants";
// import { zValidator } from "@hono/zod-validator";
// import { identifyCustomer } from "@/lib/services/sdk/actions/identify-customer";

// const appStoreValidateTransactionBodySchema = z.object({
// 	transactionId: z.string(),
// });

// const appStoreValidateTransactionResponseSchema = z.object({
// 	success: z.boolean(),
// });

// const route = describeRoute({
// 	description: "Validates a transaction",
// 	operationId: "appStoreValidateTransaction",
// 	security: [
// 		{
// 			publishableKey: [],
// 		},
// 	],
// 	responses: {
// 		200: {
// 			description: "Successful response",
// 			content: {
// 				"application/json": {
// 					schema: resolver(appStoreValidateTransactionResponseSchema),
// 				},
// 			},
// 		},
// 		...openApiErrorResponses,
// 	},
// 	tags: ["SDK"],
// });

// export type Route = typeof route;

// export const registerAppStoreValidateTransaction = (app: App) =>
// 	app.post(
// 		"/v1/app-store/validate-transaction",
// 		route,
// 		zValidator("json", appStoreValidateTransactionBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);

// 			if (authenticatedContext.isErr()) {
// 				throw toVoidhashHTTPError(authenticatedContext.error);
// 			}
// 		}
// 	);
