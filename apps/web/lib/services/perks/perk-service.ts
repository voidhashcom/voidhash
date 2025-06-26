import { Effect, pipe } from "effect";
import { PerkRepository } from "./perk-repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { createPerk } from "./actions/create-perk";
import { deletePerk } from "./actions/delete-perk";

export class PerkService extends Effect.Service<PerkService>()("PerkService", {
	effect: Effect.gen(function* () {
		const perkRepository = yield* PerkRepository;
		return {
			createPerk,
			getPerks: (projectId: string) =>
				pipe(
					Effect.gen(function* () {
						const environment = yield* Environment;
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
						return yield* perkRepository.getPerkById(id);
					}),
					AuthSession.withAuthSession()
				),
			deletePerk,
		};
	}),

	// Specify dependencies
	dependencies: [PerkRepository.Default],
}) {}
