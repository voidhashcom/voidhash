import { Effect, pipe } from "effect";
import { PerkRepository } from "./perk.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { createPerk } from "./actions/create-perk";
import { deletePerk } from "./actions/delete-perk";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";

export class PerkService extends Effect.Service<PerkService>()("PerkService", {
	effect: Effect.gen(function* () {
		const perkRepository = yield* PerkRepository;
		return {
			createPerk,
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
			deletePerk,
		};
	}),

	// Specify dependencies
	dependencies: [PerkRepository.Default],
}) {}
