import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { PaywallRepository } from "../paywall-repository";
import { Db, TransactionContext } from "@/lib/effect/db";

export class PaywallNotFound extends Data.TaggedError("PaywallNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaywallInUseError extends Data.TaggedError("PaywallInUseError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deletePaywallInputSchema = Schema.Struct({
	paywallId: Schema.String,
});

type DeletePaywallInput = Schema.Schema.Type<typeof deletePaywallInputSchema>;

export const deletePaywall = (inputUnsafe: DeletePaywallInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const paywallRepository = yield* PaywallRepository;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(deletePaywallInputSchema)(
				inputUnsafe
			);

			// First check if paywall exists
			const paywall = yield* paywallRepository.getPaywallById(input.paywallId);
			if (!paywall) {
				return yield* Effect.fail(
					new PaywallNotFound({
						message: `Paywall ${input.paywallId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				paywall.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete paywall ${input.paywallId} for project ${paywall.projectId}`
			);

			// Check if paywall is being used by any paywall locations
			const paywallLocationsUsingPaywall = yield* paywallRepository.getPaywallLocationsUsingPaywall(input.paywallId);
			if (paywallLocationsUsingPaywall.length > 0) {
				return yield* Effect.fail(
					new PaywallInUseError({
						message: "You cannot delete this paywall, because some paywall locations are still using it. Please update the paywall locations to use a different paywall first, or delete the paywall locations.",
					})
				);
			}

			// Use transaction to delete paywall products and paywall
			yield* db.transaction((tx) => TransactionContext.provide(tx)(
				Effect.gen(function* () {
					// Delete paywall products first
					yield* paywallRepository.deletePaywallProducts(input.paywallId);
					// Then delete the paywall
					yield* paywallRepository.deletePaywall(input.paywallId);
				}))
			);

			yield* Effect.log(`Deleted paywall ${input.paywallId}`);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
