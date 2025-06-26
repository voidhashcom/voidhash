import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PerkRepository } from "../perk-repository";
import { generateId } from "@/lib/id/generate";

export class SlugAlreadyExistsError extends Data.TaggedError(
	"SlugAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createPerkInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
	slug: Schema.String.pipe(
		Schema.minLength(3),
		Schema.maxLength(32),
		Schema.pattern(/^[a-z0-9_-]+$/)
	),
});

type CreatePerkInput = Schema.Schema.Type<typeof createPerkInputSchema>;

export const createPerk = (inputUnsafe: CreatePerkInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const perkRepository = yield* PerkRepository;
			const input = Schema.decodeUnknownSync(createPerkInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				input.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to create perks for project ${input.projectId}`
			);

			const perk = yield* perkRepository.getPerkBySlug({
				slug: input.slug,
				projectId: input.projectId,
				environment: environment,
			});
			if (perk) {
				return yield* Effect.fail(
					new SlugAlreadyExistsError({
						message:
							"Perk with this slug already exists. Please choose a different slug.",
					})
				);
			}

			const newPerk = {
				id: generateId("perk"),
				slug: input.slug,
				projectId: input.projectId,
				name: input.name,
				environment: environment,
			};

			yield* perkRepository.createPerk(newPerk);
			yield* Effect.log(
				`Created perk ${newPerk.id} for project ${input.projectId}`
			);

			// TODO: Adding a perk should unlock it for existing users?

			return yield* Effect.succeed({
				id: newPerk.id,
			});
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);
