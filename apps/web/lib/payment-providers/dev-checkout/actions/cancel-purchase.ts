import { CheckoutSessionRepository } from "@/lib/services/checkout-session/checkout-session.repository";
import { Data, Effect, pipe, Schema } from "effect";

export const cancelDevCheckoutPurchaseInputSchema = Schema.Struct({
	checkoutSessionId: Schema.String,
});

type CancelDevCheckoutPurchaseInput = Schema.Schema.Type<typeof cancelDevCheckoutPurchaseInputSchema>;


export class CheckoutSessionNotFound extends Data.TaggedError("CheckoutSessionNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CheckoutSessionWasAlreadyCancelled extends Data.TaggedError("CheckoutSessionWasAlreadyCancelled")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class CheckoutSessionWasAlreadyConfirmed extends Data.TaggedError("CheckoutSessionWasAlreadyConfirmed")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const cancelPurchase = (inputUnsafe: CancelDevCheckoutPurchaseInput) =>
	pipe(
		Effect.gen(function* () {
            const checkoutSessionRepository = yield* CheckoutSessionRepository;
            const checkoutSession = yield* checkoutSessionRepository.getCheckoutSessionById(inputUnsafe.checkoutSessionId);

            if (!checkoutSession) {
                return yield* Effect.fail(new CheckoutSessionNotFound({
                    message: "Checkout session not found",
                }));
            }

            if (checkoutSession.status === "cancelled") {
                return {
                    redirectUrl: checkoutSession.successCallbackUrl,
                }
            }

            if (checkoutSession.status === "success") {
                return yield* Effect.fail(new CheckoutSessionWasAlreadyConfirmed({
                    message: "Checkout session was already confirmed",
                }));
            }

            yield* checkoutSessionRepository.updateCheckoutSession({
                id: inputUnsafe.checkoutSessionId,
                status: "cancelled",
            });

            return {
                redirectUrl: checkoutSession.successCallbackUrl,
            };
		}),
	);
