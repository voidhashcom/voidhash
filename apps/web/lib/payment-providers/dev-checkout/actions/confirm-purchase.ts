import { CheckoutSessionRepository } from "@/lib/services/checkout-session/checkout-session.repository";
import { Data, Effect, pipe, Schema } from "effect";

export const confirmDevCheckoutPurchaseInputSchema = Schema.Struct({
	checkoutSessionId: Schema.String,
});

type ConfirmDevCheckoutPurchaseInput = Schema.Schema.Type<typeof confirmDevCheckoutPurchaseInputSchema>;

export class CheckoutSessionNotFound extends Data.TaggedError("CheckoutSessionNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CheckoutSessionWasAlreadyCancelled extends Data.TaggedError("CheckoutSessionWasAlreadyCancelled")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const confirmPurchase = (inputUnsafe: ConfirmDevCheckoutPurchaseInput) =>
	pipe(
		Effect.gen(function* () {
			const checkoutSessionRepository = yield* CheckoutSessionRepository;
			const checkoutSession = yield* checkoutSessionRepository.getCheckoutSessionById(inputUnsafe.checkoutSessionId);

			if (!checkoutSession) {
				return yield* Effect.fail(new CheckoutSessionNotFound({
					message: "Checkout session not found",
				}));
			}

			if (checkoutSession.status === "success") {
				return {
                    redirectUrl: checkoutSession.successCallbackUrl,
                };
			}

			if (checkoutSession.status === "error") {
				return yield* Effect.fail(new CheckoutSessionWasAlreadyCancelled({
					message: "Checkout session was already cancelled",
				}));
			}

            // TODO: Process the purchase

            yield* checkoutSessionRepository.updateCheckoutSession({
                id: inputUnsafe.checkoutSessionId,
                status: "success",
            });

            return {
                redirectUrl: checkoutSession.successCallbackUrl,
            };
		}),
	);
