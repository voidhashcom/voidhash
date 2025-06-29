import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PaymentProviderRepository } from "../payment-provider-repository";
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

export const createPaymentProviderConfigurationInputSchema = Schema.Struct({
	projectId: Schema.String,
	providerId: Schema.String,
});

type CreatePaymentProviderConfigurationInput = Schema.Schema.Type<typeof createPaymentProviderConfigurationInputSchema>;

export const createPaymentProviderConfiguration = (inputUnsafe: CreatePaymentProviderConfigurationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const paymentProviderRepository = yield* PaymentProviderRepository;
			const input = Schema.decodeUnknownSync(createPaymentProviderConfigurationInputSchema)(
				inputUnsafe
			);

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

			const canHaveMultipleConfigurations = provider.getType() === "native";

			// Check if configuration already exists for non-native providers
			if (!canHaveMultipleConfigurations) {
				const existingConfiguration = yield* paymentProviderRepository.getExistingPaymentProviderConfigurationByProviderId({
					projectId: input.projectId,
					providerId: input.providerId,
				});
				
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

			yield* paymentProviderRepository.createPaymentProviderConfiguration(newConfiguration);
			yield* Effect.log(
				`Created payment provider configuration ${id} for project ${input.projectId}`
			);

			return yield* Effect.succeed({
				id,
			});
		}),
		AuthSession.withAuthSession()
	);
