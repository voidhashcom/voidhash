import { Effect, pipe } from "effect";
import { PaywallRepository } from "./paywall-repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { createPaywall } from "./actions/create-paywall";
import { deletePaywall } from "./actions/delete-paywall";
import { updatePaywall } from "./actions/update-paywall";
import { checkProjectPermission } from "@/lib/effect/permissions";

export class PaywallService extends Effect.Service<PaywallService>()(
	"PaywallService",
	{
		effect: Effect.gen(function* () {
			const paywallRepository = yield* PaywallRepository;
			return {
				createPaywall,
				getPaywalls: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access paywalls for project ${projectId}`
							);

							return yield* paywallRepository.getPaywalls({
								projectId,
								environment,
							});
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),
				getPaywallById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const paywall = yield* paywallRepository.getPaywallById(id);
							if (!paywall) return null;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								paywall.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access paywall ${id} for project ${paywall.projectId}`
							);

							return paywall;
						}),
						AuthSession.withAuthSession()
					),
				getPaywallProducts: (paywallId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							
							// First get the paywall to check permissions
							const paywall = yield* paywallRepository.getPaywallById(paywallId);
							if (!paywall) return null;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								paywall.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access paywall products for paywall ${paywallId} in project ${paywall.projectId}`
							);

							return yield* paywallRepository.getPaywallProducts(paywallId);
						}),
						AuthSession.withAuthSession()
					),
				updatePaywall,
				deletePaywall,
			};
		}),

		// Specify dependencies
		dependencies: [PaywallRepository.Default],
	}
) {}
