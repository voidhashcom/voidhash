import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

/**
 * Coarse category of a diagnostic, so hosts can route to logging versus
 * alerting without matching on individual codes.
 */
export type VoidhashDiagnosticKind = "transport" | "eviction" | "breaker" | "auth" | "cache";

/**
 * A non-fatal event the SDK handled on its own. Diagnostics are informational:
 * every one of them describes a situation the SDK already recovered from
 * (retry scheduled, cache served, event evicted). They never require the host
 * app to act.
 */
export interface VoidhashDiagnostic {
  /** Category used for routing (logging vs. alerting). */
  readonly kind: VoidhashDiagnosticKind;
  /** Stable, machine-matchable identifier — see {@link DIAGNOSTIC_CODES}. */
  readonly code: string;
  /** SDK operation that produced the diagnostic (`capture`, `getPerson`, …). */
  readonly operation: string;
  /** Whether the SDK will try the same work again on its own. */
  readonly retryable: boolean;
  /** HTTP status behind the diagnostic, when there was a response. */
  readonly httpStatus?: number;
  /** Human-readable detail. Not stable; do not parse. */
  readonly message?: string;
}

/** Stable diagnostic codes emitted by the SDK. */
export const DIAGNOSTIC_CODES = {
  /** A queued analytics event was evicted because the queue hit its cap. */
  ANALYTICS_EVENT_DROPPED: "ANALYTICS_EVENT_DROPPED",
  /** The publishable key was rejected; outbound traffic is paused. */
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  /** A cached entry could not be read or decoded and was treated as a miss. */
  CACHE_READ_FAILED: "CACHE_READ_FAILED",
  /** A write to device storage failed; the value is still held in memory. */
  CACHE_WRITE_FAILED: "CACHE_WRITE_FAILED",
  /** Entries written by a pre-namespace SDK release could not be migrated. */
  CACHE_MIGRATION_FAILED: "CACHE_MIGRATION_FAILED",
  /** The breaker for a host is open, so the request was skipped. */
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  /** A request failed and the SDK fell back to cache or a retry. */
  REQUEST_FAILED: "REQUEST_FAILED",
  /** A request exceeded the per-attempt timeout. */
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  /** A background task the SDK owns failed outright. */
  BACKGROUND_TASK_FAILED: "BACKGROUND_TASK_FAILED",
  /** A queued transaction receipt was discarded as unsendable. */
  TRANSACTION_RECEIPT_DROPPED: "TRANSACTION_RECEIPT_DROPPED",
  /** A transaction receipt is waiting in the outbox for a successful sync. */
  TRANSACTION_SYNC_DEFERRED: "TRANSACTION_SYNC_DEFERRED",
} as const;

/** Handler supplied through the `onDiagnostic` client option. */
// oxlint-disable-next-line effect/prefer-option-over-null -- public SDK option consumed by non-Effect app code.
export type VoidhashDiagnosticHandler = (diagnostic: VoidhashDiagnostic) => void;

/**
 * Fan-out point for {@link VoidhashDiagnostic}s. Exceptions thrown by the host
 * handler are swallowed: a broken reporting hook must never take down the SDK
 * path that produced the diagnostic.
 */
export class Diagnostics extends Context.Service<
  Diagnostics,
  {
    readonly emit: (diagnostic: VoidhashDiagnostic) => Effect.Effect<void>;
    readonly emitUnsafe: (diagnostic: VoidhashDiagnostic) => void;
  }
>()("rn-voidhash/Diagnostics") {
  /** Layer that drops every diagnostic. Used when no handler is configured. */
  static readonly noop = Layer.succeed(Diagnostics, {
    emit: () => Effect.void,
    emitUnsafe: () => undefined,
  });
}

/** Builds a {@link Diagnostics} layer around an optional host handler. */
export const makeDiagnosticsLayer = (handler: Option.Option<VoidhashDiagnosticHandler>) => {
  const emitUnsafe = (diagnostic: VoidhashDiagnostic) => {
    if (Option.isNone(handler)) return;
    // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: the handler is a plain callback the app supplies and may throw anything.
    try {
      handler.value(diagnostic);
    } catch {
      // A throwing host handler is never allowed to fail the SDK operation
      // that emitted the diagnostic.
    }
  };

  return Layer.succeed(Diagnostics, {
    emit: (diagnostic: VoidhashDiagnostic) => Effect.sync(() => emitUnsafe(diagnostic)),
    emitUnsafe,
  });
};
