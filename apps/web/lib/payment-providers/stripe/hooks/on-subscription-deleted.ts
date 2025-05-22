import { ServiceContext } from "@/lib/service-function";
import Stripe from "stripe";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { mapSubscriptionStatus } from "../utils";
import { getPurchaseByProviderKeyQuery } from "@/lib/services/purchases/raw-queries";
import { handlePurchaseUpdated } from "@/lib/services/purchases/hooks/on-purchased-updated";
import { err, ok, Result, ResultAsync } from "neverthrow";

type HandleSubscriptionDeletedError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export async function handleSubscriptionDeleted(
	serviceContext: ServiceContext,
	projectId: string,
	stripe: Stripe,
	event: Stripe.Event
): Promise<Result<void, HandleSubscriptionDeletedError>> {
	try {
		const subscriptionDeleted = event.data.object as Stripe.Subscription;
		// Retrieve the subscription from stripe, because the event object may be outdated due to webhook ordering being not guaranteed

		const subscription = await ResultAsync.fromPromise(
			stripe.subscriptions.retrieve(subscriptionDeleted.id),
			(e) => fromUnknownThrow(e)
		);
		if (subscription.isErr()) {
			return err(subscription.error);
		}

		if (!subscription.value) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "No stripe subscription found.",
				originalError: new Error("No stripe subscription found."),
			});
		}

		const subscriptionItem = subscription.value.items.data[0];
		const productId = subscriptionItem?.price.product;
		const priceId = subscriptionItem?.price.id;

		if (!subscriptionItem || !productId || !priceId) {
			serviceContext.logger.error(
				"No product id or price id found in checkout session event."
			);
			return ok(undefined);
		}

		const purchase = (
			await getPurchaseByProviderKeyQuery(
				serviceContext,
				subscriptionDeleted.id
			)
		).orElse((e) => {
			if (e.code === "NOT_FOUND") {
				return ok(undefined);
			}
			return err(e);
		});

		if (purchase.isErr()) {
			return err(purchase.error);
		}

		if (!purchase.value) {
			serviceContext.logger.error("No purchase found for stripe subscription.");
			return ok(undefined);
		}

		const purchaseUpdated = await handlePurchaseUpdated(serviceContext, {
			purchaseId: purchase.value.id,
			status: mapSubscriptionStatus(subscription.value.status),
			canceledAt: subscription.value.canceled_at
				? new Date(subscription.value.canceled_at * 1000)
				: null,
			cancelAtPeriodEnd: subscription.value.cancel_at_period_end,
			expiresAt: new Date(subscriptionItem.current_period_end * 1000),
		});

		if (purchaseUpdated.isErr()) {
			return err(purchaseUpdated.error);
		}

		return ok(undefined);
	} catch (e: unknown) {
		serviceContext.logger.error(
			`Stripe webhook failed. Error: ${e instanceof Error ? e.message : "Unknown error"}`
		);
		return err(fromUnknownThrow(e));
	}
}
