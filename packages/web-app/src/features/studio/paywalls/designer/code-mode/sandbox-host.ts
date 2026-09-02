import {
  ComponentManifestSchema,
  countSlotNodes,
  PreviewTreeSchema,
  SIZE_CAPS,
  strictParseOptions,
  type ComponentManifest,
  type PreviewTree,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { sandboxRuntimeBundle } from "@voidhash/paywalls/sandbox-bundle";
import { Duration, Effect, Result, Schema } from "effect";

import { SANDBOX_DOCUMENT } from "./sandbox-document";

const decodeManifest = Schema.decodeUnknownSync(ComponentManifestSchema, strictParseOptions);
const decodeTree = Schema.decodeUnknownSync(PreviewTreeSchema, strictParseOptions);

const RENDER_TIMEOUT_MS = 4000;
const READY_TIMEOUT_MS = 6000;

export type SandboxOutcome =
  | {
      ok: true;
      manifest: ComponentManifest;
      previewTrees: Record<string, PreviewTree>;
      /** Whether the definition declared a custom editor panel (sibling of `manifest`). */
      hasPanel: boolean;
    }
  | { ok: false; error: string };

interface RawResult {
  requestId: string;
  ok: boolean;
  error?: string;
  manifest?: unknown;
  hasPanel?: unknown;
  previewTrees?: Record<string, unknown>;
}

interface IncomingMessage {
  type?: string;
  requestId?: string;
  ok?: boolean;
  error?: string;
  manifest?: unknown;
  hasPanel?: unknown;
  previewTrees?: Record<string, unknown>;
}

/** One queued render request awaiting its turn on the single iframe. */
interface QueuedRender {
  readonly compiledCode: string;
  readonly resolve: (result: SandboxOutcome) => void;
}

/**
 * Manages the hidden sandbox iframe that executes compiled components. The host
 * trusts nothing the sandbox returns: every preview tree is strict-decoded,
 * size-capped, and slot-checked; the manifest is decoded against §2. Hung
 * renders are killed by a watchdog that restarts the iframe.
 *
 * All renders are serialized through an in-host FIFO queue with at most one
 * in-flight render, because the studio fires a `compile()` per changed
 * component definition without awaiting. A single hung render must fail ONLY
 * itself: its watchdog rejects just the in-flight request and restarts the
 * iframe, then the queue keeps draining against the fresh iframe. Without the
 * queue, one hung render's restart would reject every concurrent sibling.
 */
export class SandboxHost {
  private iframe: HTMLIFrameElement | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private counter = 0;
  private destroyed = false;
  /**
   * Set synchronously while `pump` owns the drain — including across the `await`
   * on the ready race, before `inFlight` is assigned — so a concurrent `render`
   * call can never shift a second job onto the iframe.
   */
  private pumping = false;
  private readonly queue: QueuedRender[] = [];
  /** The single in-flight render, or null when idle. */
  private inFlight: {
    readonly requestId: string;
    readonly resolve: (result: SandboxOutcome) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  } | null = null;

  render(compiledCode: string): Promise<SandboxOutcome> {
    if (this.destroyed || typeof document === "undefined") {
      return Effect.runPromise(
        Effect.succeed<SandboxOutcome>({ error: "sandbox unavailable", ok: false }),
      );
    }
    return Effect.runPromise(
      Effect.callback<SandboxOutcome>((resume) => {
        this.queue.push({
          compiledCode,
          resolve: (result) => resume(Effect.succeed(result)),
        });
        void this.pump();
      }),
    );
  }

  /**
   * Drains the queue one render at a time. Re-entrant calls are no-ops while a
   * render is in flight; the completion/timeout paths re-invoke `pump` to pick
   * up the next queued request.
   */
  private async pump(): Promise<void> {
    if (this.pumping || this.inFlight || this.destroyed) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.pumping = true;

    // Resolve this job, release the drain lock, and pick up the next queued
    // render. Every non-dispatch exit routes through here so `pumping` is always
    // cleared and the queue keeps draining.
    const finishWithout = (outcome: SandboxOutcome): void => {
      next.resolve(outcome);
      this.pumping = false;
      void this.pump();
    };

    if (!this.iframe) {
      this.mount();
    }
    if (!this.iframe || !this.readyPromise) {
      finishWithout({ error: "sandbox unavailable", ok: false });
      return;
    }

    // Bound the ready wait: a sandbox that never signals ready (blocked load /
    // CSP) must surface an error, not hang the whole compile forever. Restart so
    // the NEXT queued render gets a fresh attempt.
    const readyPromise = this.readyPromise;
    const ready = await Effect.runPromise(
      Effect.promise(() => readyPromise).pipe(
        Effect.as(true),
        Effect.timeoutOrElse({
          duration: Duration.millis(READY_TIMEOUT_MS),
          orElse: () => Effect.succeed(false),
        }),
      ),
    );
    if (this.destroyed) {
      // Destroyed mid-await: this job was already shifted off the queue, so
      // `destroy` never saw it — resolve it here so its caller isn't stranded.
      next.resolve({ error: "sandbox destroyed", ok: false });
      this.pumping = false;
      return;
    }
    if (!ready) {
      this.restartIframe();
      finishWithout({ error: "component sandbox failed to initialize", ok: false });
      return;
    }

    const target = this.iframe?.contentWindow;
    if (!target) {
      finishWithout({ error: "sandbox unavailable", ok: false });
      return;
    }

    const requestId = String((this.counter += 1));
    const timer = setTimeout(() => {
      // Reject ONLY the in-flight request, then restart the iframe and keep
      // draining — sibling renders queued behind a hung one still run.
      this.inFlight = null;
      this.restartIframe();
      next.resolve({ error: "component render timed out", ok: false });
      void this.pump();
    }, RENDER_TIMEOUT_MS);
    this.inFlight = { requestId, resolve: next.resolve, timer };
    // The render is now in flight; `inFlight` guards re-entry, so release the
    // synchronous drain lock. The result/timeout paths re-invoke `pump`.
    this.pumping = false;
    target.postMessage(
      {
        compiledCode: next.compiledCode,
        requestId,
        sandboxCode: sandboxRuntimeBundle,
        type: "render",
      },
      "*",
    );
  }

  destroy(): void {
    this.destroyed = true;
    if (this.inFlight) {
      clearTimeout(this.inFlight.timer);
      this.inFlight.resolve({ error: "sandbox destroyed", ok: false });
      this.inFlight = null;
    }
    for (const queued of this.queue.splice(0)) {
      queued.resolve({ error: "sandbox destroyed", ok: false });
    }
    this.teardown();
  }

  private mount(): void {
    if (typeof document === "undefined") {
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "Paywall component sandbox";
    iframe.style.display = "none";
    iframe.srcdoc = SANDBOX_DOCUMENT;
    // `Effect.callback`'s register runs synchronously when the fiber is forked,
    // so `readyResolve` is set before `mount` returns.
    this.readyPromise = Effect.runPromise(
      Effect.callback<void>((resume) => {
        // Cleared before resuming so a repeated `ready` message is a no-op,
        // matching `Promise` resolve idempotency.
        this.readyResolve = () => {
          this.readyResolve = null;
          resume(Effect.void);
        };
      }),
    );
    window.addEventListener("message", this.handleMessage);
    document.body.appendChild(iframe);
    this.iframe = iframe;
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }
    const data = event.data as IncomingMessage;
    if (data.type === "ready") {
      this.readyResolve?.();
      return;
    }
    if (data.type === "result" && typeof data.requestId === "string") {
      const entry = this.inFlight;
      // Ignore results that don't match the current in-flight request — a stale
      // message from an iframe restarted after its watchdog fired.
      if (!entry || entry.requestId !== data.requestId) {
        return;
      }
      clearTimeout(entry.timer);
      this.inFlight = null;
      entry.resolve(
        this.validate({
          error: data.error,
          manifest: data.manifest,
          hasPanel: data.hasPanel,
          ok: data.ok ?? false,
          previewTrees: data.previewTrees,
          requestId: data.requestId,
        }),
      );
      void this.pump();
    }
  };

  private validate(raw: RawResult): SandboxOutcome {
    if (!raw.ok) {
      return { error: raw.error ?? "unknown render error", ok: false };
    }
    const manifest = Effect.runSync(
      Effect.try({
        try: (): ComponentManifest => decodeManifest(raw.manifest),
        catch: errorMessage,
      }).pipe(Effect.result),
    );
    if (Result.isFailure(manifest)) {
      return { error: `invalid manifest: ${manifest.failure}`, ok: false };
    }
    const previewTrees: Record<string, PreviewTree> = {};
    for (const [state, tree] of Object.entries(raw.previewTrees ?? {})) {
      previewTrees[state] = validateTree(tree, state);
    }
    // `hasPanel` is host-only preview metadata (not part of the strict manifest
    // schema): coerce to a plain boolean, defaulting false for older guests.
    return { hasPanel: raw.hasPanel === true, manifest: manifest.success, ok: true, previewTrees };
  }

  /**
   * Tears down and re-mounts the iframe WITHOUT touching the queue or the
   * in-flight request — the caller (a render watchdog or ready timeout) has
   * already resolved the one request it is failing. Subsequent queued renders
   * run against the fresh iframe.
   */
  private restartIframe(): void {
    this.teardown();
    if (!this.destroyed) {
      this.mount();
    }
  }

  private teardown(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.handleMessage);
    }
    this.iframe?.remove();
    this.iframe = null;
    this.readyPromise = null;
    this.readyResolve = null;
  }
}

function validateTree(tree: unknown, state: string): PreviewTree {
  const outcome = Effect.runSync(
    Effect.gen(function* () {
      const size = yield* Effect.try({
        try: () => new TextEncoder().encode(JSON.stringify(tree)).byteLength,
        catch: errorMessage,
      });
      if (size > SIZE_CAPS.previewTree) {
        return yield* Effect.fail("preview tree exceeds size cap");
      }
      const decoded = yield* Effect.try({
        try: (): PreviewTree => decodeTree(tree),
        catch: errorMessage,
      });
      const slots = yield* Effect.try({
        try: () => countSlotNodes(decoded.root),
        catch: errorMessage,
      });
      if (slots > 1) {
        return yield* Effect.fail("a component may declare at most one <Slot />");
      }
      return decoded;
    }).pipe(Effect.result),
  );
  if (Result.isFailure(outcome)) {
    return {
      root: { reason: `invalid preview: ${outcome.failure}`, type: "placeholder" },
      state,
      treeVersion: 1,
    };
  }
  return outcome.success;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
