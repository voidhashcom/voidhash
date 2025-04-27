import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { getApiKeyByIdQuery, getApiKeysQuery } from "./raw-queries";
import { Environments } from "@/lib/services/environments/types";
import { cache } from "react";

export const getApiKeyByIdInputSchema = z.object({
	id: z.string(),
});
export const getApiKeyById = cache(
	createServiceFunction()
		.input(getApiKeyByIdInputSchema)
		.function(async ({ ctx, input }) => {
			const authenticatedContextPromise = authenticateContext(ctx);

			const apiKeyPromise = ctx.cache.cacheFn(
				async (keyId: string) => {
					return getApiKeyByIdQuery(authenticatedContext, keyId);
				},
				["api-key", input.id],
				{
					tags: [`api-key_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

			const [authenticatedContext, apiKey] = await Promise.all([
				authenticatedContextPromise,
				apiKeyPromise,
			]);

			if (!apiKey) {
				return null;
			}

			if (!hasProjectPermission(authenticatedContext, apiKey?.projectId, "")) {
				return null;
			}

			return apiKey;
		}).invoke
);

export const getApiKeysInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments).optional(),
});
export const getApiKeys = cache(
	createServiceFunction()
		.input(getApiKeysInputSchema)
		.function(async ({ ctx, input }) => {
			const authenticatedContext = await authenticateContext(ctx);

			if (!hasProjectPermission(authenticatedContext, input.projectId, "")) {
				return [];
			}

			const apiKeys = await ctx.cache.cacheFn(
				async (projectId: string) => {
					return getApiKeysQuery(authenticatedContext, projectId);
				},
				["api-keys", input.projectId],
				{
					tags: [`api-keys_${input.projectId}`],
					revalidate: 3600,
				}
			)(input.projectId);

			if (input.environment) {
				const availableApiKeys = apiKeys.filter(
					(key) => key.environment === input.environment
				);

				return availableApiKeys;
			}

			return apiKeys;
		}).invoke
);
