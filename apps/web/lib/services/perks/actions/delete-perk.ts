import { AuthSession } from "@/lib/effect/auth";
import { Data, Effect, pipe, Schema } from "effect";
import { PerkRepository } from "../perk-repository";
import { hasProjectPermission } from "@/lib/effect/permissions";
import { ForbiddenError } from "@/lib/effect/errors";

// export const deletePerkInputSchema = z.object({
// 	perkId: z.string(),
// });

// type DeletePerkError =
// 	| VoidhashUnauthorizedError
// 	| VoidhashForbiddenError
// 	| VoidhashInternalServerError
// 	| VoidhashNotFoundError;

// export const deletePerk = createServiceFunction()
// 	.input(deletePerkInputSchema)
// 	.use(isAuthenticated)
// 	.function(async ({ input, ctx }): Promise<Result<void, DeletePerkError>> => {
// 		const existingPerk = await getPerkByIdQuery(ctx, input.perkId);
// 		if (existingPerk.isErr()) {
// 			return err(existingPerk.error);
// 		}

// 		if (
// 			!hasProjectPermission(ctx, existingPerk.value.projectId, "project:all")
// 		) {
// 			return err({
// 				code: "FORBIDDEN",
// 				message: "You are not authorized to delete this perk",
// 			});
// 		}

// 		try {
// 			await ctx.db.delete(perks).where(eq(perks.id, input.perkId));
// 			return ok(undefined);
// 		} catch (error) {
// 			return err(fromUnknownThrow(error));
// 		}
// 	});

export class PerkNotFound extends Data.TaggedError("PerkNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deletePerkInputSchema = Schema.Struct({
	perkId: Schema.String,
});

type DeletePerkInput = Schema.Schema.Type<typeof deletePerkInputSchema>;

export const deletePerk = (inputUnsafe: DeletePerkInput) =>
	pipe(
		Effect.gen(function* () {
			const input = Schema.decodeUnknownSync(deletePerkInputSchema)(
				inputUnsafe
			);
			const session = yield* AuthSession;
			const perkRepository = yield* PerkRepository;
			const perk = yield* perkRepository.getPerkById(input.perkId);
			if (!perk) {
				return yield* Effect.fail(
					new PerkNotFound({
						message: `Perk with id ${input.perkId} not found`,
					})
				);
			}

			if (!hasProjectPermission(perk.projectId, "project:all")) {
				yield* Effect.logWarning(
					`User ${session?.user?.id} is not authorized to delete perk ${input.perkId}`
				);
				return yield* Effect.fail(
					new ForbiddenError({
						message: "You are not authorized to delete this perk",
					})
				);
			}

			yield* perkRepository.deletePerk(input.perkId);
		}),
		AuthSession.withAuthSession()
	);
