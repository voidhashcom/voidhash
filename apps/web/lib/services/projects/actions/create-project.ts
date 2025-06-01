import { generateId } from "@/lib/id/generate";
import {
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import { createPublishableKey } from "@/lib/services/api-keys/utils";
import { Environments } from "@/lib/services/environments/types";
import { projects, apiKeys } from "@voidhash/db";
import {
	fromUnknownThrow,
	SLUG_BLACKLIST,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { createSlug, createShortId } from "@voidhash/lib/functions";
import { randomUUID } from "crypto";
import { err, ok, Result } from "neverthrow";
import { z } from "zod";
import { getProjectBySlugQuery } from "../raw-queries";
import { isAuthenticated } from "@/lib/middlewares";

export const createProjectInputSchema = z.object({
	name: z.string().min(1).max(32),
	organizationId: z.string(),
});

type CreateProjectError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const createProject = createServiceFunction()
	.input(createProjectInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string; slug: string }, CreateProjectError>> => {
			if (
				!hasOrganizationPermission(
					ctx,
					input.organizationId,
					"organization:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create a projects",
				});
			}

			const userId = ctx.session?.user?.id;
			if (!userId) {
				return err({
					code: "UNAUTHORIZED",
					message: "You are not authorized to create a projects",
				});
			}

			const id = generateId("project");
			let slug = createSlug(input.name);

			if (SLUG_BLACKLIST.includes(slug)) {
				slug = slug + "-" + createShortId();
			}

			const existingProject = await getProjectBySlugQuery(
				ctx,
				input.organizationId,
				slug
			);

			// Project exists
			if (existingProject.isOk()) {
				slug = slug + "-" + randomUUID();
			}

			if (existingProject.isErr()) {
				if (existingProject.error.code !== "NOT_FOUND") {
					return err(existingProject.error);
				}
			}

			try {
				await ctx.db.transaction(async (tx) => {
					await tx.insert(projects).values({
						id,
						name: input.name,
						slug,
						organizationId: input.organizationId,
						createdByUserId: userId,
					});

					// Save production publishable key
					const productionPublishableKey = await createPublishableKey(
						Environments.Production
					);
					await tx.insert(apiKeys).values({
						id: generateId("apiPublishableKey"),
						projectId: id,
						name: "Publishable key",
						...productionPublishableKey,
					});

					// Save testing publishable key
					const testingPublishableKey = await createPublishableKey(
						Environments.Testing
					);
					await tx.insert(apiKeys).values({
						id: generateId("apiPublishableKeyTesting"),
						projectId: id,
						name: "Publishable key",
						...testingPublishableKey,
					});
				});

				ctx.cache.invalidate(`project_${id}`);
				ctx.cache.invalidate(`project_${input.organizationId}_slug:${slug}`);
				ctx.cache.invalidate(`projects_${input.organizationId}`);

				return ok({
					id,
					slug,
				});
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
