import { Effect } from "effect";
import { createCheckout } from "./actions/create-checkout";
import { getPaywallByLocation } from "./actions/get-paywall-by-location";
import { identifyCustomer } from "./actions/identify-customer";
import { getCustomerOrCreateAnonymous } from "./actions/get-customer-or-create-anonymous";

export class SdkService extends Effect.Service<SdkService>()(
	"SdkService",
	{
		effect: Effect.gen(function* () {
			return {
				createCheckout,
				getPaywallByLocation,
				identifyCustomer,
				getCustomerOrCreateAnonymous,
            }
		}),

		// Specify dependencies
		dependencies: [],
	}
) {}
