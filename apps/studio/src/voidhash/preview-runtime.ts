import type { PaywallBridge, PaywallOutboundEnvelope } from "@voidhash/paywalls";
import { Clock, Effect } from "effect";

import { DEFAULT_PREVIEW_DEVICE_PROFILE, previewConfigForDevice } from "./preview-devices";

/**
 * Mock products + variables injected into previewed paywalls (contract §7.1).
 * On a device the native SDK supplies these; in Studio we fake a representative
 * subscription group so product-driven layouts render with realistic data.
 * `id` mirrors a store product identifier, `slug` the Voidhash product slug.
 */
export const DEFAULT_PREVIEW_CONFIG = previewConfigForDevice(DEFAULT_PREVIEW_DEVICE_PROFILE);

/** A captured outbound envelope with a monotonically increasing id + timestamp. */
export interface PreviewEvent {
  readonly key: number;
  readonly at: number;
  readonly envelope: PaywallOutboundEnvelope;
}

// Module-scoped so every emitted event has a unique key even if more than one
// bridge instance exists (React StrictMode double-invokes the `useMemo` factory
// that creates the bridge, yielding two closures that would otherwise both start
// their counter at 0 and collide).
let eventCounter = 0;

/**
 * A {@link PaywallBridge} that records every outbound envelope a previewed
 * paywall posts so Studio can display them, instead of forwarding to a
 * (non-existent) native host. Studio renders the paywall in-process — it never
 * delivers inbound envelopes (`configure`/`response`/`status`), so `subscribe`
 * is a no-op subscription.
 */
export const createStudioBridge = (onEvent: (event: PreviewEvent) => void): PaywallBridge => ({
  post: (envelope) => {
    eventCounter += 1;
    onEvent({ at: Effect.runSync(Clock.currentTimeMillis), envelope, key: eventCounter });
  },
  subscribe: () => () => {},
});

/**
 * A bridge that drops everything. Used for static component previews in the
 * sidebar so their mount-time `ready` envelopes don't pollute the event log.
 */
export const SILENT_BRIDGE: PaywallBridge = {
  post: () => {},
  subscribe: () => () => {},
};
