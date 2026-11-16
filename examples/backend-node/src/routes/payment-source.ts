import { toNodeHandler, type VoidhashProvider } from "@voidhash/node/providers";

import { BillingError, type Billing } from "../billing";
import { HttpError, readJsonObject, requireString, sendJson } from "../http";
import type { RouteHandler } from "../server";

/**
 * `POST /voidhash/provider` — the payment source's endpoint. `toNodeHandler`
 * reads the raw body itself, verifies the signature, and writes the answer;
 * without a signing secret the route answers 503.
 */
export const createPaymentSourceRoute = (provider: VoidhashProvider | undefined): RouteHandler => {
  if (provider === undefined) {
    return (_request, response) => {
      sendJson(response, 503, { error: "provider_secret_not_configured" });
    };
  }

  const handle = toNodeHandler(provider);
  return (request, response) => handle(request, response);
};

/**
 * `POST /v1/checkout` — starts a purchase. This server creates the checkout at
 * the provider itself and stores the buyer's Voidhash distinct id on it (here
 * `buyerId`; with a real provider, the checkout's metadata), so the payment
 * the provider reports later names the same person.
 */
export const createCheckoutRoute =
  (billing: Billing): RouteHandler =>
  async (request, response) => {
    const body = await readJsonObject(request);
    const input = {
      buyerId: requireString(body.distinctId, "distinct_id_required"),
      cancelUrl: requireString(body.cancelUrl, "cancel_url_required"),
      priceId: requireString(body.priceId, "price_id_required"),
      successUrl: requireString(body.successUrl, "success_url_required"),
    };

    try {
      sendJson(response, 201, billing.openCheckout(input));
    } catch (error) {
      if (error instanceof BillingError) throw new HttpError(404, "price_not_found", error.message);
      throw error;
    }
  };

/**
 * `GET /billing/pay?checkout=…` — the fake provider's hosted checkout page. A
 * real provider shows a payment form; this one pays at once, which fires the
 * `payment.succeeded` event, and sends the buyer back to the `successUrl` the
 * checkout was created with.
 */
export const createHostedCheckoutRoute =
  (billing: Billing): RouteHandler =>
  (_request, response, url) => {
    const checkoutId = url.searchParams.get("checkout") ?? "";

    try {
      const checkout = billing.completeCheckout(checkoutId);
      response.writeHead(303, { location: checkout.successUrl });
      response.end();
    } catch (error) {
      if (error instanceof BillingError)
        throw new HttpError(404, "checkout_not_found", error.message);
      throw error;
    }
  };
