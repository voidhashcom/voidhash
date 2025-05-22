import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { getOrganizationById } from "../organizations/queries";
import { getProjectById } from "../projects/queries";
import { getEnvironment } from "@/lib/services/environments/utils";
import { createSecretKey as generateSecretKeyFn } from "@/lib/services/api-keys/utils";
import { ApiKey, apiKeys } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { getApiKeyByIdQuery } from "./raw-queries";
export const createSecretKeyInputSchema = z.object({
	projectId: z.string(),
	name: z.string().min(3, "Name must be at least 3 characters long"),
});

type CreateSecretKeyError =
	| VoidhashForbiddenError
	| VoidhashNotFoundError
	| VoidhashBadRequestError
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError;

export const createSecretKey = createServiceFunction()
	.input(createSecretKeyInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<ApiKey, CreateSecretKeyError>> => {
			const authenticatedContext = await authenticateContext(ctx);

			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasProjectPermission(
					authenticatedContext.value,
					input.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to create an api key for this project",
				});
			}

			const project = await getProjectById({
				ctx: authenticatedContext.value,
				input: { id: input.projectId },
			});

			if (project.isErr()) {
				return err(project.error);
			}

			const organization = await getOrganizationById({
				ctx: authenticatedContext.value,
				input: { id: project.value.organizationId },
			});

			if (organization.isErr()) {
				return err(organization.error);
			}

			if (!organization.value.slug) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Organization slug not found - " + organization.value.id,
					originalError: new Error(
						"Organization slug not found - " + organization.value.id
					),
				});
			}

			const environment = (
				await getEnvironment(
					ctx.cookies,
					organization.value.slug,
					project.value.slug
				)
			).orElse((e) => {
				return e.code === "NOT_FOUND"
					? err({
							code: "INTERNAL_SERVER_ERROR",
							message: "Environment not found",
							originalError: new Error(
								"Environment not found - " +
									organization.value.slug +
									" - " +
									project.value.slug
							),
						} as VoidhashInternalServerError)
					: err(e);
			});

			if (environment.isErr()) {
				return err(environment.error);
			}

			const { rawKey, ...secretKey } = await generateSecretKeyFn(
				environment.value
			);

			try {
				const apiKeyId = generateId("apiSecretKey");
				await ctx.db.insert(apiKeys).values({
					id: apiKeyId,
					projectId: project.value.id,
					name: input.name,
					...secretKey,
				});

				const apiKey = await getApiKeyByIdQuery(ctx, apiKeyId);

				if (apiKey.isErr()) {
					return err(apiKey.error);
				}

				ctx.cache.invalidate(`api-keys_${project.value.id}`);
				return ok({ ...apiKey.value, rawKey });
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
