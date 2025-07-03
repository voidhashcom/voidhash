import {
	SubscriptionStatus,
	SubscriptionStatusValue,
} from "@voidhash/lib/constants";
import { Stripe } from "stripe";

export const mapSubscriptionStatus = (
	status: Stripe.Subscription.Status
): SubscriptionStatusValue => {
	switch (status) {
		case "active":
			return SubscriptionStatus.Active;

		case "trialing":
			return SubscriptionStatus.Active;

		default:
			return SubscriptionStatus.Canceled;
	}
};
