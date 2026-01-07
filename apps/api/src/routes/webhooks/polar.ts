/**
 * Polar.sh webhook endpoint
 *
 * Handles subscription and payment events from Polar.sh
 * POST /webhooks/polar
 */
import {
  HttpLayerRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import {
  BillingService,
  PolarBillingProviderLive,
  type PolarConfig,
  PolarConfigService,
  UsageService,
  handlePolarWebhook,
} from "@voidhash/core/services";
import { Db } from "@voidhash/db/effect";
import { Effect, Layer } from "effect";

/**
 * Polar webhook configuration from environment
 */
const polarConfig: PolarConfig = {
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  organizationId: process.env.POLAR_ORGANIZATION_ID ?? "",
  sandbox: process.env.POLAR_SANDBOX === "true",
  tierProductIds: {
    enterprise: process.env.POLAR_ENTERPRISE_PRODUCT_ID ?? "",
    pro: process.env.POLAR_PRO_PRODUCT_ID ?? "",
  },
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
};

const PolarConfigServiceLive = Layer.succeed(PolarConfigService, polarConfig);

/**
 * Billing services layer for webhook handling
 */
const BillingServicesLayer = Layer.mergeAll(
  BillingService.Default,
  UsageService.Default,
  PolarBillingProviderLive
).pipe(Layer.provide(PolarConfigServiceLive), Layer.provide(Db.Default));

/**
 * Handle incoming Polar webhook
 */
const handleWebhook = Effect.gen(function* handleWebhook() {
  const request = yield* HttpServerRequest.HttpServerRequest;

  // Get raw body for signature verification
  const body = yield* request.text;

  // Extract standard webhook headers
  const signature = request.headers["webhook-signature"] ?? "";
  const webhookId = request.headers["webhook-id"] ?? "";
  const timestamp = request.headers["webhook-timestamp"] ?? "";

  // Validate required headers
  if (!(signature && webhookId && timestamp)) {
    return yield* HttpServerResponse.json(
      { error: "Missing required webhook headers" },
      { status: 400 }
    );
  }

  // Get the webhook handler
  const handler = yield* handlePolarWebhook;

  // Process the webhook
  yield* handler({
    payload: body,
    signature,
    timestamp,
    webhookId,
  });

  return yield* HttpServerResponse.json({ received: true });
});

/**
 * Create the webhook route registration effect
 */
const registerPolarWebhookRoute = Effect.gen(
  function* registerPolarWebhookRoute() {
    const router = yield* HttpLayerRouter.HttpRouter;

    yield* router.add(
      "POST",
      "/webhooks/polar",
      handleWebhook.pipe(
        Effect.provide(BillingServicesLayer),
        Effect.catchAll((error) =>
          Effect.gen(function* registerPolarWebhookRoute() {
            yield* Effect.logError("Polar webhook error", error);
            return yield* HttpServerResponse.json(
              { error: "Webhook processing failed" },
              { status: 500 }
            );
          })
        )
      )
    );
  }
);

/**
 * Polar webhook route layer
 *
 * Handles POST /webhooks/polar for Polar.sh events
 */
export const PolarWebhookRouteLayer = Layer.effectDiscard(
  registerPolarWebhookRoute
);
