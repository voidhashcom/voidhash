/**
 * Stable, machine-matchable error codes surfaced on every {@link VoidhashError}
 * via `error.code`. Match on these when recovery differs; report the full error
 * for everything else.
 */
export const VOIDHASH_ERROR_CODES = [
  "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
  "FAILED_TO_CAPTURE_STARTUP_EVENTS",
  "FAILED_TO_TRANSFER_ANALYTICS_EVENTS",
  "FAILED_TO_SETUP_LIFECYCLE_EVENTS",
  "FAILED_TO_END_VOIDHASH_CLIENT",
  "FAILED_TO_FETCH_SCHEMA",
  "FAILED_TO_GET_CURRENT_PERSON",
  "FAILED_TO_SET_PERSON_ATTRIBUTES",
  "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
  "FAILED_TO_RESET_PERSON_CACHE",
  "FAILED_TO_GET_DISTINCT_ID",
  "FAILED_TO_IDENTIFY",
  "FAILED_TO_RESET",
  "FAILED_TO_SIGN_OUT",
  "FAILED_TO_SET_GROUP",
  "FAILED_TO_RESET_GROUPS",
  "FAILED_TO_GET_FEATURE_FLAGS",
  "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
  "PAYWALL_UNAVAILABLE",
  "FLOW_DISABLED",
  "FLOW_NOT_ASSIGNED",
  "FLOW_UNAVAILABLE",
  "FLOW_RENDERER_MISSING",
  "FLOW_UNSUPPORTED_PACKAGE",
  "FLOW_PRESENTATION_FAILED",
  "AUTHENTICATION_FAILED",
  "FAILED_TO_GET_PRODUCTS",
  /**
   * A purchase failed. `error.reason` says why when the store did:
   * `paymentDeclined` or `ineligibleForOffer`.
   */
  "FAILED_TO_PURCHASE",
  /** Another purchase was still running; nothing was bought. */
  "PURCHASE_IN_PROGRESS",
  /** A purchase named an offer that cannot be bought now; nothing was bought. */
  "OFFER_UNAVAILABLE",
  /** The Google Play account does not own the subscription a purchase was to replace; nothing was bought. */
  "REPLACED_SUBSCRIPTION_NOT_OWNED",
  /** Google Play refused to replace a subscription, before its sheet opened; nothing was bought. */
  "SUBSCRIPTION_REPLACEMENT_REFUSED",
  "FAILED_TO_RESTORE_PURCHASES",
  "FAILED_TO_SYNC_PURCHASES",
  "FAILED_TO_REPORT_TRANSACTION",
  "FAILED_TO_FLUSH_ANALYTICS",
  /** An analytics consent applies to this process but could not be stored on the device. */
  "FAILED_TO_SET_ANALYTICS_CONSENT",
  "FAILED_TO_PRESENT_CODE_REDEMPTION",
  "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS",
  "FAILED_TO_GET_STOREFRONT",
  "FAILED_TO_CHECK_CAN_MAKE_PAYMENTS",
  "FAILED_TO_BEGIN_REFUND_REQUEST",
  "FAILED_TO_GET_SUBSCRIPTION_STATUS",
  "FAILED_TO_GET_CURRENT_ENTITLEMENTS",
  "FAILED_TO_GET_APP_TRANSACTION",
  "FAILED_TO_SHOW_IN_APP_MESSAGES",
  "FAILED_TO_QUERY_PURCHASES",
  "FAILED_TO_CHECK_FEATURE_SUPPORT",
  "INVALID_ARGUMENT",
  "VOIDHASH_CLIENT_NOT_INITIALIZED",
  "READ_ONLY_PURCHASE_NOT_ALLOWED",
  "SCHEME_NOT_SET",
  "UNSUPPORTED_PLATFORM",
  "UNKNOWN",
] as const;

export type VoidhashErrorCode = (typeof VOIDHASH_ERROR_CODES)[number];

/**
 * Why a purchase failed, when the store said:
 *
 * - `paymentDeclined`: Google Play only. The payment method was declined,
 *   such as for insufficient funds; StoreKit reports no declined payment.
 * - `ineligibleForOffer`: the store account cannot get the offer, such as a
 *   free trial it already used on Google Play, or a promotional or win-back
 *   offer the App Store refuses it. Nothing was bought; the products reload
 *   without it, and buying again charges the regular price.
 */
export type VoidhashErrorReason = "paymentDeclined" | "ineligibleForOffer";

export class VoidhashError extends Error {
  readonly code: VoidhashErrorCode;
  /** Why it failed, when the store said; see {@link VoidhashErrorReason}. */
  readonly reason?: VoidhashErrorReason;

  constructor(
    code: VoidhashErrorCode,
    message?: string,
    options?: { cause?: unknown; reason?: VoidhashErrorReason },
  ) {
    super(message ?? code, options);
    this.name = "VoidhashError";
    this.code = code;
    if (options?.reason !== undefined) this.reason = options.reason;
  }
}

export class FailedToInitializeNativeAdapterError extends VoidhashError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("FAILED_TO_INITIALIZE_VOIDHASH_CLIENT", message, options);
    this.name = "FailedToInitializeNativeAdapterError";
  }
}

export class FailedToEndNativeAdapterError extends VoidhashError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("FAILED_TO_END_VOIDHASH_CLIENT", message, options);
    this.name = "FailedToEndNativeAdapterError";
  }
}

export class FailedToFetchSchemaError extends VoidhashError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("FAILED_TO_FETCH_SCHEMA", message, options);
    this.name = "FailedToFetchSchemaError";
  }
}

/**
 * No paywall configuration has ever been cached for a placement and the
 * server cannot be reached. Distinct from a failure: there is simply nothing
 * to show yet, so callers hide the paywall and try again later.
 */
export class PaywallUnavailableError extends VoidhashError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("PAYWALL_UNAVAILABLE", message, options);
    this.name = "PaywallUnavailableError";
  }
}

/**
 * The publishable key was rejected by the server. Surfaced once, on the first
 * read that had no cached value to answer with — every other operation keeps
 * its data queued and reports through the diagnostics hook instead.
 */
export class AuthenticationFailedError extends VoidhashError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("AUTHENTICATION_FAILED", message, options);
    this.name = "AuthenticationFailedError";
  }
}

/**
 * A method or option received a value it can never work with, such as a blank
 * distinct id or an API origin without an `http(s)://` scheme. A programmer
 * error: fix the call site rather than retrying.
 */
export class InvalidArgumentError extends VoidhashError {
  constructor(message: string) {
    super("INVALID_ARGUMENT", message);
    this.name = "InvalidArgumentError";
  }
}

export class NotInitializedError extends VoidhashError {
  constructor() {
    super(
      "VOIDHASH_CLIENT_NOT_INITIALIZED",
      "Voidhash Client was not initialized. Call init() before calling this method.",
    );
    this.name = "NotInitializedError";
  }
}

export class SchemeNotSetError extends VoidhashError {
  constructor() {
    super(
      "SCHEME_NOT_SET",
      "Scheme is not set. Pass `scheme` to createVoidhashClient or register a URL scheme in the app config.",
    );
    this.name = "SchemeNotSetError";
  }
}

export class UnsupportedPlatformError extends VoidhashError {
  constructor(platform: string, detail?: string) {
    super(
      "UNSUPPORTED_PLATFORM",
      `UNSUPPORTED_PLATFORM: ${detail ?? `unsupported platform ${platform}`}`,
    );
    this.name = "UnsupportedPlatformError";
  }
}

/** A purchase was started while another one still ran; nothing was bought. */
export class PurchaseInProgressError extends VoidhashError {
  constructor() {
    super(
      "PURCHASE_IN_PROGRESS",
      "PURCHASE_IN_PROGRESS: another purchase is still running; wait for it to finish",
    );
    this.name = "PurchaseInProgressError";
  }
}

export class ReadOnlyModePurchaseNotAllowedError extends VoidhashError {
  constructor() {
    super(
      "READ_ONLY_PURCHASE_NOT_ALLOWED",
      "Read-only mode is enabled. Purchasing is disabled for observer-only operation.",
    );
    this.name = "ReadOnlyModePurchaseNotAllowedError";
  }
}

export class UnknownVoidhashError extends VoidhashError {
  constructor(cause?: unknown) {
    super("UNKNOWN", "Unknown Voidhash error", { cause });
    this.name = "UnknownVoidhashError";
  }
}
