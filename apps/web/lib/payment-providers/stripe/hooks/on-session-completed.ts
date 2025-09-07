// import { ServiceContext } from "@/lib/service-function";
// import {
// 	getProductByIdQuery,
// 	getProviderProductByPrimaryKeyQuery,
// } from "@/lib/services/products/raw-queries";
// import Stripe from "stripe";

// import { createPaymentProviderKey } from "@/lib/services/products/lib";
// import { handleProductPurchase } from "@/lib/services/purchases/hooks/on-product-purchased";
// import { getCustomerByExternalIdentifierQuery } from "@/lib/services/customers/raw-queries";
// import {
// 	fromUnknownThrow,
// 	VoidhashBadRequestError,
// 	VoidhashInternalServerError,
// 	VoidhashNotFoundError,
// } from "@voidhash/lib/constants";
// import { mapSubscriptionStatus } from "@/lib/payment-providers/stripe/utils";
// import { err, ok, Result, ResultAsync } from "neverthrow";
// import { PaymentProviderConfiguration } from "@voidhash/db";

// type HandleSessionCompletedError =
// 	| VoidhashInternalServerError
// 	| VoidhashBadRequestError
// 	| VoidhashNotFoundError;
// export async function handleSessionCompleted(
// 	serviceContext: ServiceContext,
// 	paymentProviderConfiguration: PaymentProviderConfiguration,
// 	stripe: Stripe,
// 	event: Stripe.Event
// ): Promise<Result<void, HandleSessionCompletedError>> {
// 	try {
// 		const checkoutSession = event.data.object as Stripe.Checkout.Session;

// 		// If the checkout session is a setup session, we don't need to do anything
// 		if (checkoutSession.mode === "setup") {
// 			return ok(undefined);
// 		}

// 		if (checkoutSession.subscription == null) {
// 			// TODO: Add support for non-subscription based products
// 			serviceContext.logger.error(
// 				"No subscription id found in checkout session event. This is not a subscription based product and is not supported yet."
// 			);
// 			return ok(undefined);
// 		}

// 		const subscription = await ResultAsync.fromPromise(
// 			stripe.subscriptions.retrieve(checkoutSession.subscription as string),
// 			(e) => fromUnknownThrow(e)
// 		);

// 		if (subscription.isErr()) {
// 			return err(subscription.error);
// 		}

// 		if (!subscription.value) {
// 			return err({
// 				code: "INTERNAL_SERVER_ERROR",
// 				message: "No stripe subscription found.",
// 				originalError: new Error("No stripe subscription found."),
// 			});
// 		}

// 		const subscriptionItem = subscription.value.items.data[0];
// 		const productId = subscriptionItem?.price.product;
// 		const priceId = subscriptionItem?.price.id;

// 		if (!subscriptionItem || !productId || !priceId) {
// 			serviceContext.logger.error(
// 				"No product id or price id found in checkout session event."
// 			);
// 			return ok(undefined);
// 		}

// 		const paymentProviderKey = createPaymentProviderKey("stripe", {
// 			productId: typeof productId === "string" ? productId : productId.id,
// 			priceId: priceId,
// 		});

// 		if (paymentProviderKey.isErr()) {
// 			return err(paymentProviderKey.error);
// 		}

// 		const stripeProviderProduct = (
// 			await getProviderProductByPrimaryKeyQuery(
// 				serviceContext,
// 				paymentProviderConfiguration.id,
// 				paymentProviderKey.value,
// 				"production"
// 			)
// 		).orElse((e) => {
// 			if (e.code === "NOT_FOUND") {
// 				return ok(undefined);
// 			}
// 			return err(e);
// 		});

// 		if (stripeProviderProduct.isErr()) {
// 			return err(stripeProviderProduct.error);
// 		}

// 		if (!stripeProviderProduct.value) {
// 			return ok(undefined);
// 		}

// 		const product = await getProductByIdQuery(
// 			serviceContext,
// 			stripeProviderProduct.value.productId
// 		);
// 		if (!product) {
// 			serviceContext.logger.warn(
// 				"Stripe provider product exists while product itself does not. This shouldn't happer. Stripe provider products should be deleted when parent product is."
// 			);
// 			// TODO: Add it to unpaired purchase list if no product is found
// 			// Product was deleted, it was probably users intention, we can safely return,
// 			return ok(undefined);
// 		}

// 		const customerId =
// 			checkoutSession.customer == null
// 				? null
// 				: typeof checkoutSession.customer === "string"
// 					? checkoutSession.customer
// 					: typeof checkoutSession.customer === "object"
// 						? checkoutSession.customer.id
// 						: null;

// 		if (!customerId) {
// 			serviceContext.logger.error(
// 				"No customer id found in checkout session event. This shouldn't happen."
// 			);
// 			return ok(undefined);
// 		}

// 		const customer = (
// 			await getCustomerByExternalIdentifierQuery(
// 				serviceContext,
// 				paymentProviderConfiguration.projectId,
// 				paymentProviderConfiguration.providerId,
// 				customerId,
// 				"production" // Stripe webhooks are only supported in production
// 			)
// 		).orElse((e) => {
// 			if (e.code === "NOT_FOUND") {
// 				return ok(undefined);
// 			}
// 			return err(e);
// 		});

// 		if (customer.isErr()) {
// 			return err(customer.error);
// 		}

// 		if (!customer.value) {
// 			// TODO: Load customer from stripe
// 			// TODO: Add it to unpaired purchase list if no customer is found
// 			return ok(undefined);
// 		}

// 		const purchase = await handleProductPurchase(serviceContext, {
// 			type: "subscription",
// 			providerKey: subscription.value.id,
// 			customerId: customer.value.id,
// 			paymentProviderConfigurationProductId: stripeProviderProduct.value.id,
// 			status: mapSubscriptionStatus(subscription.value.status),
// 			startsAt: new Date(
// 				subscription.value.items.data[0]!.current_period_start * 1000
// 			),
// 			expiresAt: new Date(
// 				subscription.value.items.data[0]!.current_period_end * 1000
// 			),
// 			cancelAtPeriodEnd: subscription.value.cancel_at_period_end,
// 			canceledAt: subscription.value.canceled_at
// 				? new Date(subscription.value.canceled_at * 1000)
// 				: null,
// 			environment: "production",
// 			purchasedAt: new Date(subscription.value.created * 1000),
// 			// TODO: Add stripe related metadata to purchase
// 		});
// 		if (purchase.isErr()) {
// 			return err(purchase.error);
// 		}

// 		return ok(undefined);
// 	} catch (e: unknown) {
// 		serviceContext.logger.error(
// 			`Stripe webhook failed. Error: ${e instanceof Error ? e.message : "Unknown error"}`
// 		);
// 		return err(fromUnknownThrow(e));
// 		// TODO: Add a way to show this to the user
// 	}
// }
