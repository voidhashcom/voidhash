/**
 * Channel layer between a rendered paywall and its host.
 *
 * Outbound channels, in priority order (re-evaluated per send):
 *
 * 1. `window.ReactNativeWebView.postMessage(json)` — the production target.
 *    On iOS the native presenter injects this shim only after the page
 *    finishes loading, so early messages (notably `ready`) are queued and
 *    retried until the shim appears.
 * 2. `window.parent.postMessage({ source: "voidhash-paywall", message }, "*")`
 *    — Studio/preview contexts embedding the paywall in an iframe.
 * 3. `console.info` — last-resort logger after the retry deadline so nothing
 *    fails silently when the paywall is opened standalone in a browser.
 *
 * Inbound: the native presenters deliver raw JSON strings by calling
 * `window.onVoidhashNativeMessage(json)` (and dispatching a synthetic
 * `MessageEvent` we deliberately ignore to avoid double-handling). Studio
 * delivers `{ source: "voidhash-paywall-host", message }` objects via regular
 * `postMessage` into the iframe.
 */
import {
  type PaywallInboundEnvelope,
  type PaywallOutboundEnvelope,
  parseInboundEnvelope,
  serializeEnvelope,
} from "./envelope";

/** `source` tag on outbound `postMessage` payloads to a parent frame. */
export const STUDIO_MESSAGE_SOURCE = "voidhash-paywall";

/** `source` tag a studio host uses for inbound messages into the paywall. */
export const STUDIO_HOST_MESSAGE_SOURCE = "voidhash-paywall-host";

/** Name of the global the native presenters call to deliver inbound messages. */
export const NATIVE_INBOUND_GLOBAL = "onVoidhashNativeMessage";

declare global {
  interface Window {
    /** Injected by the native paywall presenter (RN WebView shim). */
    ReactNativeWebView?: { postMessage: (data: string) => void };
    /** Installed by the runtime; called by the native presenter with raw JSON. */
    [NATIVE_INBOUND_GLOBAL]?: (data: string) => void;
  }
}

/** Abstraction over the message channel between paywall and host. */
export interface PaywallBridge {
  /** Sends an outbound envelope to the host. */
  post: (envelope: PaywallOutboundEnvelope) => void;
  /** Subscribes to inbound envelopes. Returns an unsubscribe function. */
  subscribe: (listener: (envelope: PaywallInboundEnvelope) => void) => () => void;
}

// ── Inbound dispatch (module-level singleton) ───────────────────────────────

const inboundListeners = new Set<(envelope: PaywallInboundEnvelope) => void>();
let inboundInstalled = false;

const dispatchInbound = (raw: unknown): void => {
  const envelope = parseInboundEnvelope(raw);
  if (!envelope) {
    // biome-ignore lint/suspicious/noConsole: dev-visible signal — a host message that fails to parse would otherwise vanish silently.
    console.warn("[voidhash-paywall] ignoring unparseable inbound bridge message", raw);
    return;
  }
  for (const listener of [...inboundListeners]) {
    listener(envelope);
  }
};

const ensureInboundInstalled = (): void => {
  if (inboundInstalled || typeof window === "undefined") {
    return;
  }
  inboundInstalled = true;
  window[NATIVE_INBOUND_GLOBAL] = (data: string) => dispatchInbound(data);
  window.addEventListener("message", (event: MessageEvent) => {
    const data: unknown = event.data;
    if (
      typeof data === "object" &&
      data !== null &&
      (data as { source?: unknown }).source === STUDIO_HOST_MESSAGE_SOURCE
    ) {
      dispatchInbound((data as { message?: unknown }).message);
    }
  });
};

/**
 * Subscribes to inbound host messages on the shared channel (installing the
 * native global and the studio `message` listener on first use).
 */
export const subscribeToInboundEnvelopes = (
  listener: (envelope: PaywallInboundEnvelope) => void,
): (() => void) => {
  ensureInboundInstalled();
  inboundListeners.add(listener);
  return () => {
    inboundListeners.delete(listener);
  };
};

// ── Outbound delivery with pre-shim queueing ────────────────────────────────

const OUTBOUND_RETRY_INTERVAL_MS = 100;
const OUTBOUND_RETRY_DEADLINE_MS = 10_000;

const pendingOutbound: PaywallOutboundEnvelope[] = [];
let retryTimer: ReturnType<typeof setInterval> | undefined;
let retryDeadline = 0;

const tryDeliver = (envelope: PaywallOutboundEnvelope): boolean => {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(serializeEnvelope(envelope));
    return true;
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: STUDIO_MESSAGE_SOURCE, message: envelope }, "*");
    return true;
  }
  return false;
};

const stopRetrying = (): void => {
  if (retryTimer !== undefined) {
    clearInterval(retryTimer);
    retryTimer = undefined;
  }
};

const flushPending = (): void => {
  while (pendingOutbound.length > 0) {
    const next = pendingOutbound[0] as PaywallOutboundEnvelope;
    if (!tryDeliver(next)) {
      return;
    }
    pendingOutbound.shift();
  }
  stopRetrying();
};

const giveUpPending = (): void => {
  stopRetrying();
  for (const envelope of pendingOutbound.splice(0)) {
    // biome-ignore lint/suspicious/noConsole: deliberate standalone-preview fallback.
    console.info("[voidhash-paywall]", envelope);
  }
};

const enqueueOutbound = (envelope: PaywallOutboundEnvelope): void => {
  pendingOutbound.push(envelope);
  if (retryTimer !== undefined) {
    return;
  }
  retryDeadline = Date.now() + OUTBOUND_RETRY_DEADLINE_MS;
  retryTimer = setInterval(() => {
    flushPending();
    if (pendingOutbound.length > 0 && Date.now() >= retryDeadline) {
      giveUpPending();
    }
  }, OUTBOUND_RETRY_INTERVAL_MS);
};

/**
 * Posts an outbound envelope on the best available channel, queueing it until
 * the native shim appears when no channel exists yet. Outside a browser-like
 * environment the message is dropped (the tree renderer passes its own silent
 * bridge instead).
 */
export const postOutboundEnvelope = (envelope: PaywallOutboundEnvelope): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (pendingOutbound.length > 0) {
    // Preserve ordering while a queue is draining.
    enqueueOutbound(envelope);
    return;
  }
  if (!tryDeliver(envelope)) {
    enqueueOutbound(envelope);
  }
};

/**
 * The production bridge: posts on the detected channel (RN WebView → studio
 * parent frame → console fallback) and receives envelopes from the native
 * global / studio `postMessage` channel.
 */
export const createDefaultBridge = (): PaywallBridge => ({
  post: postOutboundEnvelope,
  subscribe: subscribeToInboundEnvelopes,
});
