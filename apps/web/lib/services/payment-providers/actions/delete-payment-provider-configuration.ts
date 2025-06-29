import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PaymentProviderRepository } from "../payment-provider-repository";

export class PaymentProviderConfigurationNotFound extends Data.TaggedError("PaymentProviderConfigurationNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deletePaymentProviderConfigurationInputSchema = Schema.Struct({
	paymentProviderConfigurationId: Schema.String,
});

type DeletePaymentProviderConfigurationInput = Schema.Schema.Type<typeof deletePaymentProviderConfigurationInputSchema>;

export const deletePaymentProviderConfiguration = (inputUnsafe: DeletePaymentProviderConfigurationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const paymentProviderRepository = yield* PaymentProviderRepository;
			const input = Schema.decodeUnknownSync(deletePaymentProviderConfigurationInputSchema)(
				inputUnsafe
			);

			// Get the payment provider configuration
			const paymentProviderConfiguration = yield* paymentProviderRepository.getPaymentProviderConfigurationById(
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

			yield* Effect.log(`Deleted payment provider configuration ${input.paymentProviderConfigurationId}`);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
