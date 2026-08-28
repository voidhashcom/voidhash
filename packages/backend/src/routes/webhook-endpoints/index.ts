/**
 * The mount point for the raw inbound webhook ingress routes. `BackendApp`
 * merges {@link InboundWebhookRoutesLayer} rather than the individual route
 * layers, so the manifest — not a hand-edited list at the call site — decides
 * what is mounted.
 *
 * The `satisfies Record<InboundWebhookRouteId, …>` below is the exhaustiveness
 * tie in both directions: a manifest entry with no layer, or a layer whose id is
 * not in the manifest, fails to typecheck. Since the smoke endpoint registry
 * enumerates the manifest, a new ingress route cannot be mounted without also
 * becoming visible to the coverage contract. `manifest.test.ts` pins the rest of
 * the tie — that every route module in this directory is in the manifest, and
 * that each one registers exactly its manifest entry.
 */
import { Layer } from "effect";

import { AppleServerToServerNotificationRouteLayer } from "./apple-server-to-server.ts";
import { GooglePlayRtdnNotificationRouteLayer } from "./google-play-rtdn.ts";
import type { InboundWebhookRouteId } from "./manifest.ts";
import { StripeWebhookNotificationRouteLayer } from "./stripe.ts";

const inboundWebhookRouteLayers = {
  "inbound_webhooks.appleServerToServer": AppleServerToServerNotificationRouteLayer,
  "inbound_webhooks.googlePlayRtdn": GooglePlayRtdnNotificationRouteLayer,
  "inbound_webhooks.stripe": StripeWebhookNotificationRouteLayer,
} satisfies Record<InboundWebhookRouteId, Layer.Layer<never, never, unknown>>;

export const InboundWebhookRoutesLayer = Layer.mergeAll(
  inboundWebhookRouteLayers["inbound_webhooks.appleServerToServer"],
  inboundWebhookRouteLayers["inbound_webhooks.googlePlayRtdn"],
  inboundWebhookRouteLayers["inbound_webhooks.stripe"],
);
