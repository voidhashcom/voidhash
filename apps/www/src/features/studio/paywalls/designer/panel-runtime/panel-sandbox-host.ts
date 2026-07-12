/**
 * The host side of the LIVE panel sandbox transport. It owns a hidden iframe
 * running the {@link ../code-mode/sandbox-document panel sandbox document},
 * speaks the strict {@link ./sandbox-messages} protocol to it, and exposes the
 * uniform {@link PanelTransport} the renderer + gesture controller drive — so
 * neither branches on the engine (a built-in panel uses the in-process
 * transport instead).
 *
 * The channel is a trust boundary. Every inbound message is envelope-decoded
 * ({@link decodeGuestMessage}), source-checked against the owning iframe, and
 * session-checked (a regenerated `sessionId` on every init/restart drops ghost
 * messages from a torn-down iframe). Every `panel/tree` is value-validated with
 * {@link decodePanelTree} (byte-capped, strict, latest-revision-wins).
 * `panel/intent` payloads are forwarded RAW to `onIntents` after only envelope
 * validation — value-level validation is the intent executor's job.
 *
 * Watchdogs bound every failure mode (see {@link PANEL_SANDBOX_WATCHDOGS}): an
 * init timeout, a ping/pong heartbeat, a tree-rate kill switch, an intent-rate
 * cap, and a protocol-violation budget. A tripped watchdog kills the iframe and
 * surfaces a restartable error; after the auto-restart budget is exhausted the
 * transport calls `onFatal` and the panel slot decides the fallback.
 */
import type { PanelSessionInputs } from "@voidhash/paywalls/panel";
import { sandboxRuntimeBundle } from "@voidhash/paywalls/sandbox-bundle";

import { PANEL_SANDBOX_DOCUMENT } from "./panel-sandbox-document";
import {
  decodeGuestMessage,
  encodeHostMessage,
  PANEL_SANDBOX_PROTOCOL,
  type GuestMessage,
  type HostMessage,
} from "./sandbox-messages";
import { decodePanelTree } from "./schema";
import type { PanelDispatchEvent, PanelSnapshot, PanelTransport } from "./transport";

/**
 * Watchdog parameters. Tuned so a healthy 60fps live panel never trips them,
 * while a wedged / abusive guest is killed within a few seconds.
 */
export const PANEL_SANDBOX_WATCHDOGS = {
  /** No `panel/ready` within this window after mount → error. */
  initTimeoutMs: 6000,
  /** Heartbeat `panel/ping` cadence. */
  pingIntervalMs: 2500,
  /** Consecutive missed pongs before the guest is declared dead. */
  maxMissedPongs: 2,
  /** Tree messages per second, sustained over the window, before a kill. */
  maxTreesPerSecond: 120,
  /** The sliding window (ms) the tree-rate kill switch samples over. */
  treeRateWindowMs: 1000,
  /** Intents per second forwarded to `onIntents` before excess is dropped. */
  maxIntentsPerSecond: 240,
  /** The sliding window (ms) the intent-rate cap samples over. */
  intentRateWindowMs: 1000,
  /** Protocol violations (malformed/oversized/wrong-schema) before a kill. */
  maxProtocolViolations: 12,
  /** Automatic restarts after a watchdog kill before `onFatal` fires. */
  maxAutoRestarts: 2,
  /**
   * Backoff before an auto-restart re-mounts, so the error snapshot is
   * observable (the slot can react) and a hot-looping failure cannot busy-spin.
   */
  restartBackoffMs: 400,
} as const;

/** Options for {@link createPanelSandboxTransport}. */
export interface PanelSandboxTransportOptions {
  /** The compiled author CJS module (the code-component definition module). */
  readonly compiledCode: string;
  /** The initial serializable host input snapshot. */
  readonly initialInputs: PanelSessionInputs;
  /**
   * Raw `panel/intent` payload (the guest's `intents` array), forwarded after
   * only envelope validation — the intent executor validates each intent's
   * value/shape and applies its own size/rate policy.
   */
  readonly onIntents: (raw: unknown) => void;
  /** Terminal failure after the auto-restart budget is exhausted. */
  readonly onFatal?: (message: string) => void;
  /**
   * The OSS sandbox IIFE bundle (evaluated once inside the iframe to install the
   * guest global + require shim). Defaults to `@voidhash/paywalls/sandbox-bundle`;
   * injectable so tests can supply a stub without shipping the ~MB bundle.
   */
  readonly sandboxCode?: string;
  /**
   * The message-source check seam. Real hosts verify `event.source ===
   * iframe.contentWindow`; tests inject an always-true check so a fake guest can
   * simulate `message` events against the transport. Receives the raw event and
   * the current iframe (or null before mount).
   */
  readonly isTrustedSource?: (
    event: MessageEvent,
    iframe: HTMLIFrameElement | null,
  ) => boolean;
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Real source check: the message came from the iframe we own. */
const defaultIsTrustedSource = (
  event: MessageEvent,
  iframe: HTMLIFrameElement | null,
): boolean => iframe !== null && event.source === iframe.contentWindow;

let sessionCounter = 0;
/** A fresh session id per init/restart, so ghost messages never match. */
const nextSessionId = (): string => {
  sessionCounter += 1;
  return `panel-${Date.now().toString(36)}-${sessionCounter.toString(36)}`;
};

/**
 * Creates the sandbox-backed {@link PanelTransport}. The iframe is mounted lazily
 * on construction (document.body-appended + hidden, mirroring the preview
 * {@link ../code-mode/sandbox-host SandboxHost}); {@link PanelTransport.restart}
 * tears it down and re-inits with a fresh `sessionId` (fresh author state);
 * {@link PanelTransport.dispose} unmounts the session and removes the iframe.
 */
export const createPanelSandboxTransport = (
  options: PanelSandboxTransportOptions,
): PanelTransport => {
  const isTrustedSource = options.isTrustedSource ?? defaultIsTrustedSource;
  const sandboxCode = options.sandboxCode ?? sandboxRuntimeBundle;
  const canMount = typeof document !== "undefined";

  const listeners = new Set<() => void>();
  let snapshot: PanelSnapshot = { status: "loading" };

  let iframe: HTMLIFrameElement | null = null;
  let sessionId = "";
  let disposed = false;
  let ready = false;
  let latestInputs: PanelSessionInputs = options.initialInputs;
  let lastAcceptedRevision = -1;
  let autoRestarts = 0;

  // Watchdog timers / counters (reset per (re)mount).
  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let pingSeq = 0;
  let missedPongs = 0;
  let protocolViolations = 0;
  let treeTimes: number[] = [];
  let intentTimes: number[] = [];

  const now = (): number =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const setSnapshot = (next: PanelSnapshot): void => {
    snapshot = next;
    notify();
  };

  const clearTimers = (): void => {
    if (initTimer !== null) {
      clearTimeout(initTimer);
      initTimer = null;
    }
    if (pingTimer !== null) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (restartTimer !== null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const teardownIframe = (): void => {
    clearTimers();
    if (typeof window !== "undefined") {
      window.removeEventListener("message", handleMessage);
    }
    iframe?.remove();
    iframe = null;
    ready = false;
  };

  /** Posts a host→guest message (strict-encoded) to the current iframe. */
  const postToGuest = (message: HostMessage): void => {
    const target = iframe?.contentWindow;
    if (!target) return;
    target.postMessage(encodeHostMessage(message), "*");
  };

  /**
   * Kills the current iframe and surfaces a restartable error snapshot. Within
   * the auto-restart budget it schedules a backoff remount (so the error is
   * observable and a hot-looping failure can't busy-spin); once the budget is
   * exhausted it surfaces a non-restartable error and fires `onFatal` — the
   * slot then decides the fallback rendering.
   */
  const fail = (message: string): void => {
    if (disposed) return;
    teardownIframe();
    if (autoRestarts < PANEL_SANDBOX_WATCHDOGS.maxAutoRestarts) {
      autoRestarts += 1;
      setSnapshot({ status: "error", message, restartable: true });
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!disposed) mount();
      }, PANEL_SANDBOX_WATCHDOGS.restartBackoffMs);
      return;
    }
    setSnapshot({ status: "error", message, restartable: false });
    options.onFatal?.(message);
  };

  /** One protocol violation; kill once the budget is spent. */
  const countViolation = (reason: string): void => {
    protocolViolations += 1;
    if (protocolViolations > PANEL_SANDBOX_WATCHDOGS.maxProtocolViolations) {
      fail(`Panel sandbox sent too many invalid messages (${reason}).`);
    }
  };

  /** True when the sliding-window rate exceeds `max` per second. */
  const overRate = (
    times: number[],
    windowMs: number,
    maxPerSecond: number,
  ): { over: boolean; kept: number[] } => {
    const cutoff = now() - windowMs;
    const kept = times.filter((t) => t >= cutoff);
    const perSecond = (kept.length / windowMs) * 1000;
    return { over: perSecond > maxPerSecond, kept };
  };

  const acceptTree = (message: Extract<GuestMessage, { type: "panel/tree" }>): void => {
    // Tree-rate kill switch: a runaway emitter (an effect looping setState) is
    // killed rather than melting the host thread with decode + render.
    treeTimes.push(now());
    const rate = overRate(
      treeTimes,
      PANEL_SANDBOX_WATCHDOGS.treeRateWindowMs,
      PANEL_SANDBOX_WATCHDOGS.maxTreesPerSecond,
    );
    treeTimes = rate.kept;
    if (rate.over) {
      fail("Panel sandbox emitted trees too fast and was stopped.");
      return;
    }

    // Latest-revision-wins: drop a stale emission (a late rAF from before an
    // update superseded it).
    if (message.revision <= lastAcceptedRevision) {
      return;
    }

    const decoded = decodePanelTree(message.tree);
    if (!decoded.ok) {
      countViolation(`invalid tree: ${decoded.error}`);
      return;
    }
    lastAcceptedRevision = message.revision;
    setSnapshot({ status: "ready", tree: decoded.tree, revision: message.revision });
  };

  const acceptIntents = (message: Extract<GuestMessage, { type: "panel/intent" }>): void => {
    // Intent-rate cap: forward up to the budget; drop + count violations beyond
    // so a flood cannot drive the executor (or the CRDT) unbounded.
    const rate = overRate(
      intentTimes,
      PANEL_SANDBOX_WATCHDOGS.intentRateWindowMs,
      PANEL_SANDBOX_WATCHDOGS.maxIntentsPerSecond,
    );
    intentTimes = rate.kept;
    if (rate.over) {
      countViolation("intent flood");
      return;
    }
    for (const _intent of message.intents) intentTimes.push(now());
    // The executor validates each intent's value/shape — we forward RAW.
    options.onIntents(message.intents);
  };

  const onGuestMessage = (message: GuestMessage): void => {
    // A regenerated session id drops everything from a prior (torn-down) iframe.
    // The guest pins its session id from `panel/init` and stamps every message
    // (including `panel/ready`) with it, so this one check gates them all.
    if (message.sessionId !== sessionId) {
      return;
    }
    switch (message.type) {
      case "panel/ready":
        if (!ready) {
          ready = true;
          if (initTimer !== null) {
            clearTimeout(initTimer);
            initTimer = null;
          }
          startHeartbeat();
        }
        return;
      case "panel/tree":
        acceptTree(message);
        return;
      case "panel/intent":
        acceptIntents(message);
        return;
      case "panel/pong":
        missedPongs = 0;
        return;
      case "panel/error":
        fail(guestErrorMessage(message.phase, message.message));
        return;
    }
  };

  function handleMessage(event: MessageEvent): void {
    if (disposed || !isTrustedSource(event, iframe)) return;
    const decoded = decodeGuestMessage(event.data);
    if (!decoded.ok) {
      countViolation(decoded.error);
      return;
    }
    onGuestMessage(decoded.message);
  }

  const startHeartbeat = (): void => {
    if (pingTimer !== null) return;
    pingTimer = setInterval(() => {
      if (disposed || !ready) return;
      // Count a miss for the ping we're ABOUT to send whose pong hasn't arrived;
      // a live guest resets `missedPongs` to 0 on every pong.
      missedPongs += 1;
      if (missedPongs > PANEL_SANDBOX_WATCHDOGS.maxMissedPongs) {
        fail("Panel sandbox stopped responding.");
        return;
      }
      pingSeq += 1;
      postToGuest({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/ping",
        seq: pingSeq,
      });
    }, PANEL_SANDBOX_WATCHDOGS.pingIntervalMs);
  };

  function mount(): void {
    if (disposed || !canMount) {
      if (!canMount) {
        setSnapshot({
          status: "error",
          message: "Panel sandbox is unavailable in this environment.",
          restartable: false,
        });
      }
      return;
    }
    // Fresh identity + reset watchdog state for this attempt.
    sessionId = nextSessionId();
    ready = false;
    lastAcceptedRevision = -1;
    missedPongs = 0;
    protocolViolations = 0;
    pingSeq = 0;
    treeTimes = [];
    intentTimes = [];

    const el = document.createElement("iframe");
    el.setAttribute("sandbox", "allow-scripts");
    el.setAttribute("aria-hidden", "true");
    el.title = "Paywall panel sandbox";
    el.style.display = "none";
    el.srcdoc = PANEL_SANDBOX_DOCUMENT;
    window.addEventListener("message", handleMessage);
    document.body.appendChild(el);
    iframe = el;
    setSnapshot({ status: "loading" });

    initTimer = setTimeout(() => {
      if (!ready) fail("Panel sandbox failed to start.");
    }, PANEL_SANDBOX_WATCHDOGS.initTimeoutMs);

    // The guest evaluates the bundle on `panel/init`; post it immediately. The
    // iframe queues messages until its inline bootstrap installs the listener.
    postToGuest({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId,
      type: "panel/init",
      sandboxCode,
      compiledCode: options.compiledCode,
      inputs: latestInputs as unknown,
    });
  }

  mount();

  return {
    kind: "sandbox",
    update(next: unknown) {
      if (disposed) return;
      latestInputs = next as PanelSessionInputs;
      postToGuest({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/update",
        inputs: next,
      });
    },
    dispatch(event: PanelDispatchEvent) {
      if (disposed) return;
      postToGuest({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/event",
        nodeId: event.nodeId,
        name: event.name,
        args: event.args,
      });
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    restart() {
      if (disposed) return;
      // A manual restart re-arms the auto-restart budget and mounts fresh state.
      autoRestarts = 0;
      teardownIframe();
      setSnapshot({ status: "loading" });
      mount();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Best-effort unmount of the live session before discarding the iframe.
      postToGuest({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/unmount",
      });
      teardownIframe();
      listeners.clear();
    },
  };
};

const PHASE_LABEL: Record<"init" | "render" | "runtime", string> = {
  init: "Panel failed to load",
  render: "Panel failed to render",
  runtime: "Panel hit a runtime error",
};

const guestErrorMessage = (
  phase: "init" | "render" | "runtime",
  message: string,
): string => `${PHASE_LABEL[phase]}: ${message}`;
