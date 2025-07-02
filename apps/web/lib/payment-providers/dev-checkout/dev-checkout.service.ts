import { Effect } from "effect";
import { confirmPurchase } from "./actions/confirm-purchase";
import { cancelPurchase } from "./actions/cancel-purchase";

export class DevCheckoutService extends Effect.Service<DevCheckoutService>()("DevCheckoutService", {
	effect: Effect.gen(function* () {
		return {
            confirmPurchase,
            cancelPurchase,
		};
	}),

	// Specify dependencies
	dependencies: [],
}) {}
