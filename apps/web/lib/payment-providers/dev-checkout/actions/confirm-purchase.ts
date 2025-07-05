import { CheckoutSessionRepository } from "@/lib/repositories/checkout-session.repository";
import { CheckoutSession, CheckoutSessionStatus } from "@voidhash/db";
import { Data, Effect, pipe, Schema } from "effect";
import { PaymentProviderConfigurationProductRepository } from "@/lib/repositories/payment-provider-configuration-product.repository";

export const confirmDevCheckoutPurchaseInputSchema = Schema.Struct({
	checkoutSessionId: Schema.String,
});

type ConfirmDevCheckoutPurchaseInput = Schema.Schema.Type<
	typeof confirmDevCheckoutPurchaseInputSchema
>;

export class CheckoutSessionNotFound extends Data.TaggedError(
	"CheckoutSessionNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CheckoutSessionWasAlreadyCancelled extends Data.TaggedError(
	"CheckoutSessionWasAlreadyCancelled"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const confirmPurchase = (inputUnsafe: ConfirmDevCheckoutPurchaseInput) =>
	pipe(
		Effect.gen(function* () {
			const checkoutSessionRepository = yield* CheckoutSessionRepository;
			const paymentProviderConfigurationProductRepository = yield* PaymentProviderConfigurationProductRepository;

			// Load the checkout session
			const checkoutSession =
				yield* checkoutSessionRepository.getCheckoutSessionById(
					inputUnsafe.checkoutSessionId
				);
			if (!checkoutSession) {
				return yield* Effect.fail(
					new CheckoutSessionNotFound({
						message: "Checkout session not found",
					})
				);
			}
			if (checkoutSession.status !== CheckoutSessionStatus.Pending) {
				return yield* handleAlreadyProcessedCheckoutSession(checkoutSession);
			}

			// Process the purchase
			// TODO: Process the purchase
			const paymentProviderConfigurationProduct =
				yield* paymentProviderConfigurationProductRepository.getProviderProductById(
					checkoutSession.paymentProviderConfigurationProductId
				);
			if (!paymentProviderConfigurationProduct)
				return yield* Effect.dieMessage(
					"Payment provider configuration product saved in checkout session is not found. This is an inconsistency in the checkout session and this should never happen."
				);

			yield* checkoutSessionRepository.updateCheckoutSession({
				id: inputUnsafe.checkoutSessionId,
				status: CheckoutSessionStatus.Success,
			});

			return {
				redirectUrl: checkoutSession.successCallbackUrl,
			};
		})
	);

const handleAlreadyProcessedCheckoutSession = (
	checkoutSession: CheckoutSession
) =>
	Effect.gen(function* () {
		if (checkoutSession.status === CheckoutSessionStatus.Success) {
			return {
				redirectUrl: checkoutSession.successCallbackUrl,
			};
		}

		if (checkoutSession.status === CheckoutSessionStatus.Cancelled) {
			return yield* Effect.fail(
				new CheckoutSessionWasAlreadyCancelled({
					message: "Checkout session was already cancelled",
				})
			);
		}

		if (checkoutSession.status === CheckoutSessionStatus.Error) {
			return {
				redirectUrl: checkoutSession.errorCallbackUrl,
			};
		}
	});
