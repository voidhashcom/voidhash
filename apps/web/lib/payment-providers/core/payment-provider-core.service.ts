import { Effect } from "effect";
import { createSubscription, CreateSubscriptionInput } from "./steps/create-subscription";
import { syncUnlockedPerks } from "./steps/sync-unlocked-perks";

export class PaymentProviderCoreService extends Effect.Service<PaymentProviderCoreService>()("PaymentProviderCoreService", {
	effect: Effect.gen(function* () {
		return {
			createSubscription: (input: CreateSubscriptionInput) =>
				Effect.gen(function* () {
					const result = yield* createSubscription(input);
					yield* syncUnlockedPerks(input.customerId);
					return result;
				}),
		};
	}),

	// Specify dependencies
	dependencies: [],
}) {}
