// import { ServiceContext } from "@/lib/service-function";
// import Stripe from "stripe";

// export async function handleSessionCompleted(serviceContext: ServiceContext, stripe: Stripe, event: Stripe.Event) {
//     try {
// 		const checkoutSession = event.data.object as Stripe.Checkout.Session;

//         // If the checkout session is a setup session, we don't need to do anything
// 		if (checkoutSession.mode === "setup") {
// 			return;
// 		}
// 		const subscription = await stripe.subscriptions.retrieve(
// 			checkoutSession.subscription as string,
// 		);

// 		const priceId = subscription.items.data[0]?.price.id;
// 		const plan = await getPlanByPriceId(options, priceId as string);

// 		if (plan) {
// 			const referenceId =
// 				checkoutSession?.client_reference_id ||
// 				checkoutSession?.metadata?.referenceId;

// 			const subscriptionId = checkoutSession?.metadata?.subscriptionId;
// 			const seats = subscription.items.data[0].quantity;
// 			if (referenceId && subscriptionId) {
// 				const trial =
// 					subscription.trial_start && subscription.trial_end
// 						? {
// 								trialStart: new Date(subscription.trial_start * 1000),
// 								trialEnd: new Date(subscription.trial_end * 1000),
// 							}
// 						: {};

// 				let dbSubscription =
// 					await ctx.context.adapter.update<InputSubscription>({
// 						model: "subscription",
// 						update: {
// 							plan: plan.name.toLowerCase(),
// 							status: subscription.status,
// 							updatedAt: new Date(),
// 							periodStart: new Date(
// 								subscription.items.data[0].current_period_start * 1000,
// 							),
// 							periodEnd: new Date(
// 								subscription.items.data[0].current_period_end * 1000,
// 							),
// 							stripeSubscriptionId: checkoutSession.subscription as string,
// 							seats,
// 							...trial,
// 						},
// 						where: [
// 							{
// 								field: "id",
// 								value: subscriptionId,
// 							},
// 						],
// 					});

// 				if (trial.trialStart && plan.freeTrial?.onTrialStart) {
// 					await plan.freeTrial.onTrialStart(dbSubscription as Subscription);
// 				}

// 				if (!dbSubscription) {
// 					dbSubscription = await ctx.context.adapter.findOne<Subscription>({
// 						model: "subscription",
// 						where: [
// 							{
// 								field: "id",
// 								value: subscriptionId,
// 							},
// 						],
// 					});
// 				}
// 				await options.subscription?.onSubscriptionComplete?.({
// 					event,
// 					subscription: dbSubscription as Subscription,
// 					stripeSubscription: subscription,
// 					plan,
// 				});
// 				return;
// 			}
// 		}
// 	} catch (e: any) {
// 		logger.error(`Stripe webhook failed. Error: ${e.message}`);
// 	}
// }
