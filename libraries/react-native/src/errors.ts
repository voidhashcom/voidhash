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
  "FAILED_TO_GET_FEATURE_FLAGS",
  "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
  "FAILED_TO_BUILD_PAYWALL_RUNTIME_CONFIG",
  "FAILED_TO_GET_PRODUCTS",
  "FAILED_TO_PURCHASE",
  "FAILED_TO_RESTORE_PURCHASES",
  "FAILED_TO_FLUSH_ANALYTICS",
  "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET",
  "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS",
  "VOIDHASH_CLIENT_NOT_INITIALIZED",
  "READ_ONLY_PURCHASE_NOT_ALLOWED",
  "SCHEME_NOT_SET",
  "UNSUPPORTED_PLATFORM",
  "UNKNOWN",
] as const;

export type VoidhashErrorCode = (typeof VOIDHASH_ERROR_CODES)[number];

export class VoidhashError extends Error {
  readonly code: VoidhashErrorCode;

  constructor(code: VoidhashErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "VoidhashError";
    this.code = code;
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
    super("SCHEME_NOT_SET", "Scheme is not set in expo.config.ts.");
    this.name = "SchemeNotSetError";
  }
}

export class UnsupportedPlatformError extends VoidhashError {
  constructor(platform: string) {
    super("UNSUPPORTED_PLATFORM", `Unsupported platform: ${platform}`);
    this.name = "UnsupportedPlatformError";
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
