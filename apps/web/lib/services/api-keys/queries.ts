import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getApiKeyByIdQuery, getApiKeysQuery } from "./raw-queries";
import { Environments } from "@/lib/services/environments/types";
import { cache } from "react";
import { err, ok, Result } from "neverthrow";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { ApiKey } from "@voidhash/db";
import { isAuthenticated } from "@/lib/middlewares";

export const getApiKeyByIdInputSchema = z.object({
	id: z.string(),
});

type GetApiKeyByIdError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashForbiddenError
	| VoidhashUnauthorizedError;
export const getApiKeyById = cache(
	createServiceFunction()
		.input(getApiKeyByIdInputSchema)
		.use(isAuthenticated)
		.function(
			async ({ ctx, input }): Promise<Result<ApiKey, GetApiKeyByIdError>> => {
				// const apiKeyPromise = ctx.cache.cacheFn(
				// 	async (keyId: string) => {
				// 		const apiKey = await getApiKeyByIdQuery(ctx, keyId);
				// 		if (apiKey.isErr()) {
				// 			return err(apiKey.error);
				// 		}
				// 		return ok(apiKey.value);
				// 	},
				// 	["api-key", input.id],
				// 	{
				// 		tags: [`api-key_${input.id}`],
				// 		revalidate: 3600,
				// 	}
				// )(input.id);

				const apiKey = await getApiKeyByIdQuery(ctx, input.id);

				if (apiKey.isErr()) {
					return err(apiKey.error);
				}

				if (!hasProjectPermission(ctx, apiKey.value.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "You are not allowed to access this API key",
					});
				}

				return ok(apiKey.value);
			}
		).invoke
);

export const getApiKeysInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments).optional(),
});

type GetApiKeysError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError;

export const getApiKeys = cache(
	createServiceFunction()
		.input(getApiKeysInputSchema)
		.use(isAuthenticated)
		.function(
			async ({ ctx, input }): Promise<Result<ApiKey[], GetApiKeysError>> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message:
							"You are not allowed to retrieve API keys for this project",
					});
				}

				// const apiKeys = await ctx.cache.cacheFn(
				// 	async (projectId: string) => {
				// 		const apiKeys = await getApiKeysQuery(
				// 			authenticatedContext.value,
				// 			projectId
				// 		);
				// 		if (apiKeys.isErr()) {
				// 			return err(apiKeys.error);
				// 		}
				// 		return ok(apiKeys.value);
				// 	},
				// 	["api-keys", input.projectId],
				// 	{
				// 		tags: [`api-keys_${input.projectId}`],
				// 		revalidate: 3600,
				// 	}
				// )(input.projectId);

				const apiKeys = await getApiKeysQuery(ctx, input.projectId);

				if (apiKeys.isErr()) {
					return err(apiKeys.error);
				}

				if (input.environment) {
					const availableApiKeys = apiKeys.value.filter(
						(key) => key.environment === input.environment
					);

					return ok(availableApiKeys);
				}

				return ok(apiKeys.value);
			}
		).invoke
);
