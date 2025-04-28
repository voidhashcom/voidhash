import Stripe from "stripe";
import { HTTPException } from "hono/http-exception";
import { App } from "@/lib/api/hono/app";
import { getExistingPaymentProviderConfigurationByIdQuery } from "@/lib/services/payment-providers/raw-queries";
import { stripe as stripePaymentProvider, stripeProviderId } from "../stripe";
import { z } from "zod";
import { ALLOWED_EVENTS } from "../constants";
// Assuming App type might be defined elsewhere, adjust import as needed
// import { App } from '../../hono/app'; // Example path - adjust based on actual location
// Assuming error responses might be defined elsewhere
// import { openApiErrorResponses } from '../../errors/openapi_responses'; // Example path

// Initialize Stripe (using api version from library is recommended)

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

			if (!paymentProviderConfiguration) {
				throw new HTTPException(400, { message: "Project not found" });
			}

			const configuration =
				paymentProviderConfiguration?.configuration as z.infer<
					typeof stripePaymentProvider.configuration.configurationSchema
				>;

			const stripeWebhookSecret = configuration.webhookSecret;
			const stripeSecretKey = configuration.secretKey;

			if (paymentProviderConfiguration.enabled === false) {
				throw new HTTPException(400, {
					message: "Stripe is not enabled for this project.",
				});
			}

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
			switch (event.type) {
				case "checkout.session.completed":
					break;
				case "customer.subscription.updated":
					break;
				case "customer.subscription.deleted":
					break;
				// ... handle other event types as needed
				// e.g., 'customer.subscription.created', 'customer.subscription.deleted', etc.
				default:
					break;
			}

			// Return a 200 response to acknowledge receipt of the event
			return c.json({ received: true });
		}
	);
};
