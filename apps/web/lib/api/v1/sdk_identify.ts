import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { openApiErrorResponses } from "../errors/openapi_responses";
import {
	customerResponseSchema,
	sdkCustomerResponseSchema,
	sdkIdentifyCustomerBodySchema,
} from "./schema";
import { App } from "../hono/app";
import { z } from "zod";
import { toVoidhashHTTPError } from "@voidhash/lib/constants";
import { zValidator } from "@hono/zod-validator";
import { createHonoRuntime } from "@/lib/effect/runtimes/hono";
import { tryCatch } from "@/lib/try-catch";
import { SdkService } from "@/lib/services/sdk/sdk.service";
import { pipe, Effect } from "effect";
import { Auth, AuthSession } from "@/lib/effect/auth";

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
			const runtime = createHonoRuntime(c);
			
			const result = await tryCatch(
				runtime.runPromise(Effect.gen(function* () {
					const authService = yield* Auth;
					const authSession = yield* authService.authenticate;
					
					return yield* AuthSession.provide(authSession)(pipe(
						SdkService,
						Effect.flatMap((sdkService) =>
							sdkService.identifyCustomer({
								appUserId: c.req.valid("json").appUserId,
								name: c.req.valid("json").name,
								email: c.req.valid("json").email,
							})
						)
					))
				}))
			);

			if (result.error) {
				throw toVoidhashHTTPError(result.error);
			}

			return c.json<z.infer<typeof customerResponseSchema>>({
				customerId: result.data.id,
				name: result.data.name ?? null,
				email: result.data.email,
				appUserId: result.data.appUserId ?? null,
				// origin: result.data.origin,
			});
		}
	);
