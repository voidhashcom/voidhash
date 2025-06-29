import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PaymentProviderRepository } from "../payment-provider-repository";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";


export class PaymentProviderConfigurationNotFound extends Data.TaggedError("PaymentProviderConfigurationNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderNotFoundError extends Data.TaggedError(
	"PaymentProviderNotFoundError"
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

export const updatePaymentProviderConfigurationInputSchema = Schema.Struct({
	id: Schema.String,
	enabled: Schema.Boolean,
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))),
	configuration: Schema.Record({key: Schema.String, value: Schema.Unknown}),
});

type UpdatePaymentProviderConfigurationInput = Schema.Schema.Type<typeof updatePaymentProviderConfigurationInputSchema>;

export const updatePaymentProviderConfiguration = (inputUnsafe: UpdatePaymentProviderConfigurationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const paymentProviderRepository = yield* PaymentProviderRepository;
			const input = Schema.decodeUnknownSync(updatePaymentProviderConfigurationInputSchema)(
				inputUnsafe
			);

			// Get existing configuration
			const existingConfiguration = yield* paymentProviderRepository.getPaymentProviderConfigurationById(input.id);
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
				const configurationSchema = provider.getGlobalConfigurationSchema();
				if (!configurationSchema) {
					return yield* Effect.fail(
						new ValidationError({
							message: `Provider ${provider.getId()} does not have a configuration`,
						})
					);
				}

				const parseResult = yield* Effect.try({
					try: () => configurationSchema.parse(input.configuration),
					catch: (error) => new ValidationError({
						message: "Validation error",
						cause: error,
					})
				});
				parsedConfiguration = parseResult;
			}

			// Create payment provider key and check availability if enabling
			let paymentProviderKey: string | undefined;
			if (input.enabled) {
				paymentProviderKey = provider.createGlobalKey(parsedConfiguration as Record<string, unknown>);
				const isKeyAvailable = yield* paymentProviderRepository.checkPaymentProviderKeyAvailability({
					key: paymentProviderKey,
					providerId: provider.getId(),
					projectId: existingConfiguration.projectId,
					excludeId: input.id,
				});

				if (!isKeyAvailable) {
					return yield* Effect.fail(
						new PaymentProviderKeyUnavailableError({
							message: "Payment provider with similar configuration already exists.",
						})
					);
				}
			}

			// Update the configuration
			yield* paymentProviderRepository.updatePaymentProviderConfiguration({
				id: input.id,
				configuration: parsedConfiguration,
				enabled: input.enabled,
				name: input.name,
				...(paymentProviderKey && { paymentProviderKey }),
			});

			yield* Effect.log(`Updated payment provider configuration ${input.id}`);

			return yield* Effect.succeed({
				id: input.id,
			});
		}),
		AuthSession.withAuthSession()
	);
