import { Data, Effect } from "effect";
import { PaymentProviderRepository } from "../repositories/payment-provider.repository";
import { AuthSession } from "@/lib/services/auth.service";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { generateId } from "@/lib/id/generate";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";

export class PaymentProviderNotFoundError extends Data.TaggedError(
	"PaymentProviderNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderAlreadyExistsError extends Data.TaggedError(
	"PaymentProviderAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
	"PaymentProviderConfigurationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderKeyUnavailableError extends Data.TaggedError(
	"PaymentProviderKeyUnavailableError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderService extends Effect.Service<PaymentProviderService>()(
	"PaymentProviderService",
	{
		dependencies: [PaymentProviderRepository.Default],
		effect: Effect.gen(function* () {
			const paymentProviderRepository = yield* PaymentProviderRepository;
			return {
				createPaymentProviderConfiguration: (input: {
					projectId: string;
					providerId: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const paymentProviderRepository = yield* PaymentProviderRepository;

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							input.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to create payment provider configurations for project ${input.projectId}`
						);

						// Find the payment provider
						const provider = paymentProviders.find(
							(p) => p.getId() === input.providerId
						);
						if (!provider) {
							return yield* Effect.fail(
								new PaymentProviderNotFoundError({
									message: `Provider ${input.providerId} not found`,
								})
							);
						}

						const canHaveMultipleConfigurations =
							provider.getType() === "native";

						// Check if configuration already exists for non-native providers
						if (!canHaveMultipleConfigurations) {
							const existingConfiguration =
								yield* paymentProviderRepository.getExistingPaymentProviderConfigurationByProviderId(
									{
										projectId: input.projectId,
										providerId: input.providerId,
									}
								);

							if (existingConfiguration) {
								return yield* Effect.fail(
									new PaymentProviderAlreadyExistsError({
										message: `Provider ${input.providerId} can only have one configuration`,
									})
								);
							}
						}

						const id = generateId("paymentProviderConfiguration");

						const newConfiguration = {
							id,
							configuration: provider.getDefaultGlobalConfiguration(),
							enabled: provider.getIsConfigurable() ? false : true,
							name: provider.getTitle(),
							providerId: input.providerId,
							projectId: input.projectId,
							paymentProviderKey: "empty",
						};

						yield* paymentProviderRepository.createPaymentProviderConfiguration(
							newConfiguration
						);
						yield* Effect.log(
							`Created payment provider configuration ${id} for project ${input.projectId}`
						);

						return yield* Effect.succeed({
							id,
						});
					}),

				getPaymentProviderConfigurations: (projectId: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`
						);

						return yield* paymentProviderRepository.getPaymentProviderConfigurations(
							projectId
						);
					}),

				getPaymentProviderConfigurationById: (id: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const configuration =
							yield* paymentProviderRepository.getPaymentProviderConfigurationById(
								id
							);

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

				updatePaymentProviderConfiguration: (input: {
					id: string;
					enabled: boolean;
					name?: string;
					configuration: Record<string, unknown>;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const paymentProviderRepository = yield* PaymentProviderRepository;

						// Get existing configuration
						const existingConfiguration =
							yield* paymentProviderRepository.getPaymentProviderConfigurationById(
								input.id
							);
						if (!existingConfiguration) {
							return yield* Effect.fail(
								new PaymentProviderConfigurationNotFound({
									message: "Payment provider configuration not found",
								})
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							existingConfiguration.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to update payment provider configuration ${input.id}`
						);

						// Find the payment provider
						const provider = paymentProviders.find(
							(p) => p.getId() === existingConfiguration.providerId
						);
						if (!provider) {
							return yield* Effect.fail(
								new PaymentProviderNotFoundError({
									message: `Provider ${existingConfiguration.providerId} not found`,
								})
							);
						}

						const requireValidation = input.enabled;

						// Validate configuration if required
						let parsedConfiguration = input.configuration;
						if (requireValidation) {
							const configurationSchema =
								provider.getGlobalConfigurationSchema();
							if (!configurationSchema) {
								return yield* Effect.fail(
									new ValidationError({
										message: `Provider ${provider.getId()} does not have a configuration`,
									})
								);
							}

							const parseResult = yield* Effect.try({
								try: () => configurationSchema.parse(input.configuration),
								catch: (error) =>
									new ValidationError({
										message: "Validation error",
										cause: error,
									}),
							});
							parsedConfiguration = parseResult;
						}

						// Create payment provider key and check availability if enabling
						let paymentProviderKey: string | undefined;
						if (input.enabled) {
							paymentProviderKey = provider.createGlobalKey(
								parsedConfiguration as Record<string, unknown>
							);
							const isKeyAvailable =
								yield* paymentProviderRepository.checkPaymentProviderKeyAvailability(
									{
										key: paymentProviderKey,
										providerId: provider.getId(),
										projectId: existingConfiguration.projectId,
										excludeId: input.id,
									}
								);

							if (!isKeyAvailable) {
								return yield* Effect.fail(
									new PaymentProviderKeyUnavailableError({
										message:
											"Payment provider with similar configuration already exists.",
									})
								);
							}
						}

						// Update the configuration
						yield* paymentProviderRepository.updatePaymentProviderConfiguration(
							{
								id: input.id,
								configuration: parsedConfiguration,
								enabled: input.enabled,
								name: input.name,
								...(paymentProviderKey && { paymentProviderKey }),
							}
						);

						yield* Effect.log(
							`Updated payment provider configuration ${input.id}`
						);

						return yield* Effect.succeed({
							id: input.id,
						});
					}),

				deletePaymentProviderConfiguration: (input: {
					paymentProviderConfigurationId: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const paymentProviderRepository = yield* PaymentProviderRepository;

						// Get the payment provider configuration
						const paymentProviderConfiguration =
							yield* paymentProviderRepository.getPaymentProviderConfigurationById(
								input.paymentProviderConfigurationId
							);

						if (!paymentProviderConfiguration) {
							return yield* Effect.fail(
								new PaymentProviderConfigurationNotFound({
									message: `Payment provider configuration with id ${input.paymentProviderConfigurationId} not found`,
								})
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							paymentProviderConfiguration.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to delete payment provider configuration ${input.paymentProviderConfigurationId}`
						);

						// Soft delete the configuration
						yield* paymentProviderRepository.deletePaymentProviderConfiguration(
							input.paymentProviderConfigurationId
						);

						yield* Effect.log(
							`Deleted payment provider configuration ${input.paymentProviderConfigurationId}`
						);

						return yield* Effect.succeed(undefined);
					}),
			};
		}),
	}
) {}
