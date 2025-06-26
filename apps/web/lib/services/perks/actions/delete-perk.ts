import { AuthSession } from "@/lib/effect/auth";
import { Data, Effect, pipe, Schema } from "effect";
import { PerkRepository } from "../perk-repository";
import { checkProjectPermission } from "@/lib/effect/permissions";

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

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				perk.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete perk ${input.perkId}`
			);

			yield* perkRepository.deletePerk(input.perkId);
		}),
		AuthSession.withAuthSession()
	);
