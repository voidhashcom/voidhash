import { Effect, pipe } from "effect";
import { PaywallLocationRepository } from "./paywall-location-repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { createPaywallLocation } from "./actions/create-paywall-location";
import { deletePaywallLocation } from "./actions/delete-paywall-location";
import { NotFoundError } from "@/lib/effect/errors";
import { checkProjectPermission } from "@/lib/effect/permissions";

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
							const session = yield* AuthSession;
							const environment = yield* Environment;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access paywall locations for project ${projectId}`
							);

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
							const session = yield* AuthSession;
							const paywallLocation =
								yield* paywallLocationRepository.getPaywallLocationById(id);
							if (!paywallLocation) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Paywall location not found",
									})
								);
							}
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								paywallLocation.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access paywall location ${id} for project ${paywallLocation.projectId}`
							);
							return paywallLocation;
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
