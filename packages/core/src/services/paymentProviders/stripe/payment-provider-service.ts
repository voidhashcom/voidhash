/**
 * Live implementation of the public {@link StripePaymentProviderService}
 * boundary for the Cloudflare backend. Delegates webhook ingress to
 * {@link StripeWebhookHandlerService}; its residual requirements (`Db`,
 * `FxRateService`, `PersonIdentityService`, `PurchaseProcessingService`,
 * `PaymentConfigSecretCrypto`, `HttpClient`) are satisfied by the backend root.
 *
 * Mirrors `appStore/payment-provider-service.ts` but with no SDK-confirmation
 * path — Stripe webhooks are authoritative and there is no client-SDK purchase
 * confirmation step. Uses `Layer.provide` (not `provideMerge`) so only the
 * public tag is exposed.
 */
import { Effect, Layer } from "effect";

import {
  StripePaymentProviderService,
  type StripePaymentProviderServiceShape,
} from "../StripePaymentProviderService.ts";
import { StripeWebhookHandlerService } from "./stripe-webhook-handler-service.ts";

/**
 * Boundary bridge (mirrors App Store / Google Play): the webhook handler
 * resolves its deps at layer-build time, but the inferred `R` still carries a
 * residual `Db` that the public shape models as `never`. `Db` is ambient at
 * call time — the service runs inside the deployed Worker with a per-request DB
 * provided at the backend root. This is the single place that gap is bridged.
 */
const asServiceShape = (value: any): StripePaymentProviderServiceShape => value;

export const StripePaymentProviderServiceLive = Layer.effect(StripePaymentProviderService)(
  Effect.gen(function* () {
    const stripeWebhookHandlerService = yield* StripeWebhookHandlerService;
    return asServiceShape({
      acceptWebhookEvent: stripeWebhookHandlerService.acceptWebhookEvent,
    });
  }),
).pipe(Layer.provide(StripeWebhookHandlerService.layer));
