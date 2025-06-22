import { SubscriptionStatus } from "@voidhash/lib/constants";
import { Stripe } from "stripe";

export const mapSubscriptionStatus = (
	status: Stripe.Subscription.Status
): SubscriptionStatus => {
	switch (status) {
		case "active":
			return "active";

		case "trialing":
			return "active";

		default:
			return "canceled";
	}
};
