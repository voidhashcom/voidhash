import { ServiceContext } from "@/lib/service-function";
import {
	getProductByIdQuery,
	getProviderProductByPrimaryKeyQuery,
} from "@/lib/services/products/raw-queries";
import Stripe from "stripe";
import { stripeProviderId } from "../stripe";
import { createPaymentProviderKey } from "@/lib/services/products/lib";
import { handleProductPurchase } from "@/lib/services/purchases/hooks/on-product-purchased";
import { getCustomerByExternalIdentifierQuery } from "@/lib/services/customers/raw-queries";
import { VoidhashError } from "@voidhash/lib/constants";
import { mapSubscriptionStatus } from "../utils";

export async function handleSessionCompleted(
	serviceContext: ServiceContext,
	projectId: string,
	stripe: Stripe,
	event: Stripe.Event
) {
	try {
		const checkoutSession = event.data.object as Stripe.Checkout.Session;

		// If the checkout session is a setup session, we don't need to do anything
		if (checkoutSession.mode === "setup") {
			return;
		}

		if (checkoutSession.subscription == null) {
			// TODO: Add support for non-subscription based products
			serviceContext.logger.error(
				"No subscription id found in checkout session event. This is not a subscription based product and is not supported yet."
			);
			return;
		}

		const subscription = await stripe.subscriptions.retrieve(
			checkoutSession.subscription as string
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

		const stripeProviderProduct = await getProviderProductByPrimaryKeyQuery(
			serviceContext,
			projectId,
			stripeProviderId,
			createPaymentProviderKey("stripe", {
				productId: typeof productId === "string" ? productId : productId.id,
				priceId: priceId,
			})
		);

		if (!stripeProviderProduct) {
			// TODO: No product setup for this in Voidhash. We should probably try to notify user about it. For now, we'll just return.
			// TODO: Add it to unpaired purchase list if no product is found
			return;
		}

		const product = await getProductByIdQuery(
			serviceContext,
			stripeProviderProduct.productId
		);
		if (!product) {
			serviceContext.logger.warn(
				"Stripe provider product exists while product itself does not. This shouldn't happer. Stripe provider products should be deleted when parent product is."
			);
			// TODO: Add it to unpaired purchase list if no product is found
			// Product was deleted, it was probably users intention, we can safely return,
			return;
		}

		const customerId =
			checkoutSession.customer == null
				? null
				: typeof checkoutSession.customer === "string"
					? checkoutSession.customer
					: typeof checkoutSession.customer === "object"
						? checkoutSession.customer.id
						: null;

		if (!customerId) {
			serviceContext.logger.error(
				"No customer id found in checkout session event. This shouldn't happen."
			);
			return;
		}

		const customer = await getCustomerByExternalIdentifierQuery(
			serviceContext,
			projectId,
			stripeProviderId,
			customerId
		);

		if (!customer) {
			// TODO: Load customer from stripe
			// TODO: Add it to unpaired purchase list if no customer is found
			return;
		}

		await handleProductPurchase(serviceContext, {
			type: "subscription",
			providerKey: subscription.id,
			customerId: customer?.id,
			providerProductId: stripeProviderProduct.id,
			status: mapSubscriptionStatus(subscription.status),
			startsAt: new Date(
				subscription.items.data[0]!.current_period_start * 1000
			),
			expiresAt: new Date(subscriptionItem.current_period_end * 1000),
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			canceledAt: subscription.canceled_at
				? new Date(subscription.canceled_at * 1000)
				: null,
			environment: "production",
			purchasedAt: new Date(subscription.created * 1000),
			// TODO: Add stripe related metadata to purchase
		});
	} catch (e: unknown) {
		serviceContext.logger.error(
			`Stripe webhook failed. Error: ${e instanceof Error ? e.message : "Unknown error"}`
		);
	}
}
