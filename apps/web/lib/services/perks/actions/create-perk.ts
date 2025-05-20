import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashConflictError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { and, eq, perks } from "@voidhash/db";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result, ResultAsync } from "neverthrow";

export const createPerkInputSchema = z.object({
	projectId: z.string(),
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
	slug: z
		.string()
		.min(3, "Slug must be at least 3 characters long")
		.max(32, "Slug must be less than 32 characters")
		.regex(
			/^[a-z0-9_-]+$/,
			"Slug must contain only lowercase letters, numbers, underscores, and hyphens"
		),
});

type CreatePerkError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashConflictError;

export const createPerk = createServiceFunction()
	.input(createPerkInputSchema)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreatePerkError>> => {
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
					message: "You are not authorized to create perks",
				});
			}

			const getPerksBySlug = ResultAsync.fromThrowable(
				ctx.db.query.perks.findFirst,
				(e) => fromUnknownThrow(e)
			);

			const existingPerk = await getPerksBySlug({
				where: and(
					eq(perks.slug, input.slug),
					eq(perks.projectId, input.projectId)
				),
			});

			if (existingPerk.isErr()) {
				return err(existingPerk.error);
			}

			if (existingPerk.value) {
				return err({
					code: "CONFLICT",
					message:
						"Perk with this slug already exists. Please choose a different slug.",
					resource: "perk",
					payload: { slug: input.slug },
				});
			}

			const newPerk = {
				id: generateId("perk"),
				slug: input.slug,
				projectId: input.projectId,
				name: input.name,
			};

			try {
				await ctx.db.insert(perks).values(newPerk);
			} catch (error) {
				return err(fromUnknownThrow(error));
			}

			// TODO: Adding a perk should unlock it for existing users?

			return ok({
				id: newPerk.id,
			});
		}
	);
