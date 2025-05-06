import { ServiceContext } from "@/lib/service-function";
import Stripe from "stripe";
import { VoidhashError } from "@voidhash/lib/constants";
import { mapSubscriptionStatus } from "../utils";
import { getPurchaseByProviderKeyQuery } from "@/lib/services/purchases/raw-queries";
import { handlePurchaseUpdated } from "@/lib/services/purchases/hooks/on-purchased-updated";

export async function handleSubscriptionDeleted(
	serviceContext: ServiceContext,
	projectId: string,
	stripe: Stripe,
	event: Stripe.Event
) {
	try {
		const subscriptionDeleted = event.data.object as Stripe.Subscription;
		// Retrieve the subscription from stripe, because the event object may be outdated due to webhook ordering being not guaranteed
		const subscription = await stripe.subscriptions.retrieve(
			subscriptionDeleted.id
		);
		if (!subscription) {
			throw new VoidhashError({
				code: "INTERNAL_SERVER_ERROR",
				message: "No stripe subscription found.",
			});
		}

		const subscriptionItem = subscription.items.data[0];
		const productId = subscriptionItem?.price.product;
		const priceId = subscriptionItem?.price.id;

		if (!subscriptionItem || !productId || !priceId) {
			serviceContext.logger.error(
				"No product id or price id found in checkout session event."
			);
			return;
		}

		const purchase = await getPurchaseByProviderKeyQuery(
			serviceContext,
			subscriptionDeleted.id
		);

		if (!purchase) {
			serviceContext.logger.error("No purchase found for stripe subscription.");
			return;
		}

		await handlePurchaseUpdated(serviceContext, {
			purchaseId: purchase.id,
			status: mapSubscriptionStatus(subscription.status),
			canceledAt: subscription.canceled_at
				? new Date(subscription.canceled_at * 1000)
				: null,
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			expiresAt: new Date(subscriptionItem.current_period_end * 1000),
		});
	} catch (e: unknown) {
		serviceContext.logger.error(
			`Stripe webhook failed. Error: ${e instanceof Error ? e.message : "Unknown error"}`
		);
	}
}
