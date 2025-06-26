import { Effect, pipe } from "effect";
import { PaywallLocationRepository } from "./paywall-location-repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { createPaywallLocation } from "./actions/create-paywall-location";
import { deletePaywallLocation } from "./actions/delete-paywall-location";

export class PaywallLocationService extends Effect.Service<PaywallLocationService>()(
	"PaywallLocationService",
	{
		effect: Effect.gen(function* () {
			const paywallLocationRepository = yield* PaywallLocationRepository;
			return {
				createPaywallLocation,
				getPaywallLocations: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const environment = yield* Environment;
							return yield* paywallLocationRepository.getPaywallLocations({
								projectId,
								environment,
							});
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),
				getPaywallLocationById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							return yield* paywallLocationRepository.getPaywallLocationById(
								id
							);
						}),
						AuthSession.withAuthSession()
					),
				deletePaywallLocation,
			};
		}),

		// Specify dependencies
		dependencies: [PaywallLocationRepository.Default],
	}
) {}
