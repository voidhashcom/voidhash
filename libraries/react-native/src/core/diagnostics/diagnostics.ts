import * as Option from "effect/Option";

/**
 * Coarse category of a diagnostic, so hosts can route to logging versus
 * alerting without matching on individual codes.
 */
export type VoidhashDiagnosticKind =
  | "transport"
  | "eviction"
  | "breaker"
  | "auth"
  | "cache"
  | "configuration"
  | "consent";

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
  /**
   * An analytics event was dropped: evicted because the queue hit its cap,
   * refused by the ingest API with a verdict re-sending cannot change, or
   * captured with properties that could not be copied into JSON.
   */
  ANALYTICS_EVENT_DROPPED: "ANALYTICS_EVENT_DROPPED",
  /**
   * Analytics work (an event, a screen, an opened notification) was skipped
   * because analytics consent is not granted. Reported once until consent is
   * granted again.
   */
  ANALYTICS_CONSENT_DENIED: "ANALYTICS_CONSENT_DENIED",
  /** The publishable key was rejected; outbound traffic is paused. */
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  /** The store could not say which ad brought the install yet; a later launch asks again. */
  INSTALL_ATTRIBUTION_DEFERRED: "INSTALL_ATTRIBUTION_DEFERRED",
  /** The SDK stopped asking the store which ad brought the install, without an answer. */
  INSTALL_ATTRIBUTION_ABANDONED: "INSTALL_ATTRIBUTION_ABANDONED",
  /**
   * Device storage could not be read, or a stored entry could not be decoded.
   * An unreadable value counts as unknown, never as absent: the SDK does not
   * overwrite it. A corrupt entry is discarded and treated as a miss.
   */
  CACHE_READ_FAILED: "CACHE_READ_FAILED",
  /** A write to device storage failed; the value is still held in memory. */
  CACHE_WRITE_FAILED: "CACHE_WRITE_FAILED",
  /**
   * @deprecated No longer emitted: the SDK has no pre-namespace entries to
   * migrate. Kept so handlers that match on it still compile.
   */
  CACHE_MIGRATION_FAILED: "CACHE_MIGRATION_FAILED",
  /** The breaker for a host is open, so the request was skipped. */
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  /**
   * A callback the app handed the SDK threw (a `usePurchase` callback,
   * `screenTracking.mapScreen`, the `connectivity` source). The SDK carried on
   * without it: the purchase kept its result, the screen was tracked unmapped.
   */
  HOST_CALLBACK_FAILED: "HOST_CALLBACK_FAILED",
  /** A client option was invalid and the SDK fell back to its default (release builds only). */
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  /** A request failed and the SDK fell back to cache or a retry. */
  REQUEST_FAILED: "REQUEST_FAILED",
  /** A request exceeded the per-attempt timeout. */
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  /** A background task the SDK owns failed outright. */
  BACKGROUND_TASK_FAILED: "BACKGROUND_TASK_FAILED",
  /**
   * A product, perk or paywall location in the project schema could not be
   * read by this SDK version and was left out. Every other entry is still
   * served; updating the SDK makes the entry available.
   */
  SCHEMA_ENTRY_SKIPPED: "SCHEMA_ENTRY_SKIPPED",
  /**
   * A queued `identify` or person-attribute write was dropped because the
   * Voidhash API refused it with a verdict re-sending cannot change.
   */
  PERSON_WRITE_REJECTED: "PERSON_WRITE_REJECTED",
  /**
   * A product the project defines was not returned by the store, so
   * `getProducts()` and `useProducts()` leave it out. Reported once per
   * product per load; the message names its slug and the store's reason.
   * Check the store product id in Studio and the product's state in App Store
   * Connect or the Play Console.
   */
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  /**
   * The store sells a product as another type than Studio, such as a Studio
   * subscription the App Store sells as a non-renewing one or Google Play as
   * an in-app product, so `getProducts()` and `useProducts()` leave it out.
   * The message names its slug and both types.
   */
  PRODUCT_TYPE_MISMATCH: "PRODUCT_TYPE_MISMATCH",
  /**
   * iOS, with `purchaseIntents: "manual"`: more App Store purchase intents
   * arrived before any `appStore.addPurchaseIntentListener()` than the SDK
   * holds for it (10), so the oldest was dropped. The end user can start that
   * purchase again on the App Store.
   */
  PURCHASE_INTENT_DROPPED: "PURCHASE_INTENT_DROPPED",
  /** A queued transaction receipt was discarded as unsendable. */
  TRANSACTION_RECEIPT_DROPPED: "TRANSACTION_RECEIPT_DROPPED",
  /**
   * The Voidhash API refused a store receipt with a verdict re-sending cannot
   * change on its own: the store is not configured for this app, or the
   * transaction is unknown or belongs to another environment. The receipt
   * stays queued and is sent again at the next launch or after six hours.
   * Reported once per receipt.
   */
  TRANSACTION_REJECTED: "TRANSACTION_REJECTED",
  /**
   * Android: a purchase the SDK started was still not recorded by Voidhash 48
   * hours after its payment went through, so the background check acknowledged
   * it on the device before Google Play refunds it. The SDK still holds the
   * receipt and delivers it.
   */
  PURCHASE_FINISHED_BEFORE_SYNC: "PURCHASE_FINISHED_BEFORE_SYNC",
  /** A transaction receipt is waiting in the outbox for a successful sync. */
  TRANSACTION_SYNC_DEFERRED: "TRANSACTION_SYNC_DEFERRED",
  /**
   * iOS: what an earlier release of this package stored on the device was not
   * carried over, because the storage it was kept under doesn't match the
   * configured base URL. Reported once per start.
   */
  LEGACY_IMPORT_SKIPPED: "LEGACY_IMPORT_SKIPPED",
} as const;

/** Handler supplied through the `onDiagnostic` client option. */
// oxlint-disable-next-line effect/prefer-option-over-null -- public SDK option consumed by non-Effect app code.
export type VoidhashDiagnosticHandler = (diagnostic: VoidhashDiagnostic) => void;

/** Delivers diagnostics to an optional host handler, swallowing whatever it throws. */
export const makeDiagnosticEmitter =
  (handler: Option.Option<VoidhashDiagnosticHandler>) => (diagnostic: VoidhashDiagnostic) => {
    if (Option.isNone(handler)) return;
    // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: the handler is a plain callback the app supplies and may throw anything.
    try {
      handler.value(diagnostic);
    } catch {
      // A throwing host handler is never allowed to fail the SDK operation
      // that emitted the diagnostic.
    }
  };
