import { Effect, pipe } from "effect";
import { PaymentProviderRepository } from "./payment-provider-repository";
import { AuthSession } from "@/lib/effect/auth";
import { createPaymentProviderConfiguration } from "./actions/create-payment-provider-configuration";
import { updatePaymentProviderConfiguration } from "./actions/update-payment-provider-configuration";
import { deletePaymentProviderConfiguration } from "./actions/delete-payment-provider-configuration";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";

export class PaymentProviderService extends Effect.Service<PaymentProviderService>()(
	"PaymentProviderService",
	{
		effect: Effect.gen(function* () {
			const paymentProviderRepository = yield* PaymentProviderRepository;
			return {
				createPaymentProviderConfiguration,
				getPaymentProviderConfigurations: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							
							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`
							);
							
							return yield* paymentProviderRepository.getPaymentProviderConfigurations(projectId);
						}),
						AuthSession.withAuthSession()
					),
				getPaymentProviderConfigurationById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const configuration = yield* paymentProviderRepository.getPaymentProviderConfigurationById(id);
							
							if (!configuration) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Payment provider configuration not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								configuration.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access payment provider configuration ${id} for project ${configuration.projectId}`
							);

							return configuration;
						}),
						AuthSession.withAuthSession()
					),
				updatePaymentProviderConfiguration,
				deletePaymentProviderConfiguration,
			};
		}),

		// Specify dependencies
		dependencies: [PaymentProviderRepository.Default],
	}
) {}
