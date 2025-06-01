import {
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
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

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
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<{ id: string }, CreatePerkError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to create perks",
				});
			}

			const res = await ResultAsync.fromPromise(
				ctx.db.query.perks.findFirst({
					where: and(
						eq(perks.slug, input.slug),
						eq(perks.projectId, input.projectId),
						eq(perks.environment, ctx.session.environment)
					),
				}),
				(e) => fromUnknownThrow(e)
			);

			if (res.isErr()) {
				return err(res.error);
			}

			if (res.value) {
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
				environment: ctx.session.environment,
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
