import { Data, Effect, pipe } from "effect";
import { PerkRepository } from "../repositories/perk.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { generateId } from "@/lib/id/generate";

export class SlugAlreadyExistsError extends Data.TaggedError(
	"SlugAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PerkNotFound extends Data.TaggedError("PerkNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}



export class PerkService extends Effect.Service<PerkService>()("PerkService", {
	effect: Effect.gen(function* () {
		const perkRepository = yield* PerkRepository;
		return {
			createPerk: (input: {
				projectId: string;
				name: string;
				slug: string;
			}) =>
				pipe(
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const environment = yield* Environment;
						const perkRepository = yield* PerkRepository;
			
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
						projectId: input.projectId,
					}),
					AuthSession.withAuthSession()
				),
			getPerks: (projectId: string) =>
				pipe(
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const environment = yield* Environment;
						// SECURITY: Authorization check
						yield* checkProjectPermission(
							projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to access perks for project ${projectId}`
						);
						return yield* perkRepository.getPerks({
							projectId,
							environment,
						});
					}),
					Environment.withEnvironment({
						projectId,
					}),
					AuthSession.withAuthSession()
				),
			getPerkById: (id: string) =>
				pipe(
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const perk = yield* perkRepository.getPerkById(id);
						if (!perk) {
							return yield* Effect.fail(
								new NotFoundError({
									message: "Perk not found",
								})
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							perk.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to access perk ${id} for project ${perk.projectId}`
						);

						return perk;
					}),
					AuthSession.withAuthSession()
				),
			deletePerk: (input: {
	perkId: string;
}) =>
	pipe(
		Effect.gen(function* () {
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
	)
,
		};
	}),

	// Specify dependencies
	dependencies: [PerkRepository.Default],
}) {}
