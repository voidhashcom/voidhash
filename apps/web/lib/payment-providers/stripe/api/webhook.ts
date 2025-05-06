import Stripe from "stripe";
import { HTTPException } from "hono/http-exception";
import { App } from "@/lib/api/hono/app";
import { getExistingPaymentProviderConfigurationByIdQuery } from "@/lib/services/payment-providers/raw-queries";
import { stripe as stripePaymentProvider, stripeProviderId } from "../stripe";
import { z } from "zod";
import { ALLOWED_EVENTS } from "../constants";
import { handleSessionCompleted } from "../hooks/on-session-completed";
import { handleSubscriptionUpdated } from "../hooks/on-subscription-updated";
import { handleSubscriptionDeleted } from "../hooks/on-subscription-deleted";

export const registerStripeWebhook = (app: App) => {
	app.post(
		"/payment-providers/stripe/webhook/:projectId",
		// Note: Hono needs the raw body for signature verification.
		async (c) => {
			const signature = c.req.header("stripe-signature");
			const rawBody = await c.req.text(); // Or appropriate method to get raw body

			if (!signature) {
				throw new HTTPException(400, { message: "Missing Stripe signature" });
			}

			const ctx = c.get("services");
			const paymentProviderConfiguration =
				await getExistingPaymentProviderConfigurationByIdQuery(
					ctx,
					c.req.param("projectId"),
					stripeProviderId
				);

			if (paymentProviderConfiguration?.enabled === false) {
				throw new HTTPException(400, {
					message: "Stripe is not enabled for this project.",
				});
			}

			if (!paymentProviderConfiguration) {
				throw new HTTPException(400, { message: "Project not found" });
			}

			const configuration =
				paymentProviderConfiguration?.configuration as z.infer<
					typeof stripePaymentProvider.configuration.configurationSchema
				>;

			const stripeWebhookSecret = configuration.webhookSecret;
			const stripeSecretKey = configuration.secretKey;

			if (!stripeWebhookSecret || !stripeSecretKey) {
				throw new HTTPException(500, {
					message: "Stripe webhook secret or secret key is not configured.",
				});
			}

			const stripe = new Stripe(stripeSecretKey, {
				apiVersion: "2025-03-31.basil", // Use the API version you intend to test against
				typescript: true,
			});

			let event: Stripe.Event;

			try {
				event = stripe.webhooks.constructEvent(
					rawBody,
					signature,
					stripeWebhookSecret
				);
			} catch (err: unknown) {
				// Check if it's an error object before accessing message
				const message = err instanceof Error ? err.message : "Unknown error";
				console.error(`Webhook signature verification failed: ${message}`);
				throw new HTTPException(400, { message: `Webhook Error: ${message}` });
			}

			// Skip processing if the event isn't one we're tracking
			if (!ALLOWED_EVENTS.includes(event.type)) return;

			// Handle the event
			try {
				switch (event.type) {
					case "checkout.session.completed":
						handleSessionCompleted(
							ctx,
							c.req.param("projectId"),
							stripe,
							event
						);
						break;
					case "customer.subscription.updated":
						handleSubscriptionUpdated(
							ctx,
							c.req.param("projectId"),
							stripe,
							event
						);
						break;
					case "customer.subscription.deleted":
						handleSubscriptionDeleted(
							ctx,
							c.req.param("projectId"),
							stripe,
							event
						);
						break;
					default:
						break;
				}
			} catch {
				throw new HTTPException(400, {
					message: "Webhook error: See server logs for more information.",
				});
			}

			// Return a 200 response to acknowledge receipt of the event
			return c.json({ received: true });
		}
	);
};
