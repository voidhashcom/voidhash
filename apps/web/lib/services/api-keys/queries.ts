import { createServiceFunction } from "@/lib/service-function";
import { z } from "zod";
import { getApiKeyByIdQuery, getApiKeysQuery } from "./raw-queries";
import { getProjectById } from "../projects/queries";
import { Environments } from "@/lib/environments/types";
import { NotFoundError, UnauthorizedError } from "@voidhash/lib/constants";
import { getUser } from "../users/queries";
import { cache } from "react";

export const getApiKeyByIdInputSchema = z.object({
	id: z.string(),
});
export const getApiKeyById = cache(
	createServiceFunction()
		.input(getApiKeyByIdInputSchema)
		.function(async ({ ctx, input }) => {
			const userPromise = getUser({ ctx });
			const apiKeyPromise = ctx.cache.cacheFn(
				async (keyId: string) => {
					return getApiKeyByIdQuery(keyId);
				},
				["api-key", input.id],
				{
					tags: [`api-key_${input.id}`],
					revalidate: 3600,
				}
			)(input.id);

			const [user, apiKey] = await Promise.all([userPromise, apiKeyPromise]);

			if (!apiKey) {
				return null;
			}

			const project = await getProjectById({
				ctx,
				input: {
					id: apiKey.projectId,
				},
			});

			if (!project) {
				return null;
			}

			// Check if user has access to this organization
			if (!user?.organizations.some((c) => c.id === project.organizationId)) {
				return null;
			}

			return apiKey;
		})
);

export const getApiKeysInputSchema = z.object({
	projectId: z.string(),
	environment: z.nativeEnum(Environments).optional(),
});
export const getApiKeys = cache(
	createServiceFunction()
		.input(getApiKeysInputSchema)
		.function(async ({ ctx, input }) => {
			const userPromise = getUser({ ctx });
			const projectPromise = getProjectById({
				ctx,
				input: {
					id: input.projectId,
				},
			});
			const [user, project] = await Promise.all([userPromise, projectPromise]);

			if (!project) {
				throw new NotFoundError("Project not found");
			}

			if (!user) {
				throw new UnauthorizedError("User not found");
			}

			const apiKeys = await ctx.cache.cacheFn(
				async (projectId: string) => {
					return getApiKeysQuery(projectId);
				},
				["api-keys", project.id],
				{
					tags: [`api-keys_${project.id}`],
					revalidate: 3600,
				}
			)(project.id);

			if (input.environment) {
				const availableApiKeys = apiKeys.filter(
					(key) => key.environment === input.environment
				);

				return availableApiKeys;
			}

			return apiKeys;
		})
);
