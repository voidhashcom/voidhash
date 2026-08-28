/**
 * The inventory of RAW inbound webhook ingress routes — the unauthenticated
 * provider-callback surface that is registered directly on the `HttpRouter`
 * instead of being declared as an `HttpApiEndpoint` in `VoidhashV1Api`.
 *
 * This module is the single source of every ingress route's method and path:
 *
 *  - the route modules in this directory register themselves with the entry
 *    exported here rather than with a literal, so a registered path can never
 *    drift from the inventory;
 *  - `./index.ts` maps the inventory onto the layers that mount it, keyed by
 *    {@link InboundWebhookRouteId}, so mounting a new ingress route does not
 *    typecheck until it exists here; and
 *  - the deployed-stage smoke tier's endpoint registry
 *    (`apps/backend/test/smoke/registry.ts`) enumerates it, so an ingress route
 *    that exists here must carry a smoke case or a written exemption.
 *
 * It deliberately imports nothing but types: the smoke registry is a unit test
 * that must be able to enumerate this surface without pulling the backend's
 * runtime graph in behind it.
 */
import type { HttpMethod, HttpRouter } from "effect/unstable/http";

/**
 * Identity of an ingress route, and the pivot the whole contract turns on:
 * `./index.ts` keys its mount map by this union, so a route can neither be
 * mounted without an id nor carry an id the inventory below does not list.
 */
export type InboundWebhookRouteId =
  | "inbound_webhooks.appleServerToServer"
  | "inbound_webhooks.googlePlayRtdn"
  | "inbound_webhooks.stripe";

/**
 * The methods `HttpRouter.add` accepts, minus its `"*"` wildcard: an ingress
 * route answers one verb. `HttpMethod` itself is wider (it includes `HEAD` and
 * `TRACE`, which the router does not register).
 */
export type InboundWebhookRouteMethod = Extract<
  HttpMethod.HttpMethod,
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
>;

export interface InboundWebhookRoute {
  readonly id: InboundWebhookRouteId;
  readonly method: InboundWebhookRouteMethod;
  /** Full path exactly as registered, including the `/api/v1` prefix. */
  readonly path: HttpRouter.PathInput;
  /** File in this directory that registers the route; the canary check pins it. */
  readonly module: string;
}

export const appleServerToServerIngressRoute: InboundWebhookRoute = {
  id: "inbound_webhooks.appleServerToServer",
  method: "POST",
  module: "apple-server-to-server.ts",
  path: "/api/v1/inbound-webhooks/apple-server-to-server/:paymentProviderConfigurationId",
};

export const googlePlayRtdnIngressRoute: InboundWebhookRoute = {
  id: "inbound_webhooks.googlePlayRtdn",
  method: "POST",
  module: "google-play-rtdn.ts",
  path: "/api/v1/inbound-webhooks/google-play-rtdn/:paymentProviderConfigurationId",
};

export const stripeIngressRoute: InboundWebhookRoute = {
  id: "inbound_webhooks.stripe",
  method: "POST",
  module: "stripe.ts",
  path: "/api/v1/inbound-webhooks/stripe/:paymentProviderConfigurationId",
};

/** Every raw ingress route the backend mounts, in registration order. */
export const inboundWebhookRoutes: ReadonlyArray<InboundWebhookRoute> = [
  appleServerToServerIngressRoute,
  googlePlayRtdnIngressRoute,
  stripeIngressRoute,
];
