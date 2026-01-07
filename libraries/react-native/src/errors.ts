export class VoidhashError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
  }
}

export class FailedToInitializeNativeAdapterError extends VoidhashError {}

export class FailedToEndNativeAdapterError extends VoidhashError {}

export class NotInitializedError extends VoidhashError {
  constructor() {
    super(
      "Voidhash Client was not initialized. Call init() before calling this method."
    );
  }
}

export class SchemeNotSetError extends VoidhashError {
  constructor() {
    super("Scheme is not set in expo.config.ts.");
  }
}

export class UnsupportedPlatformError extends VoidhashError {
  constructor(platform: string) {
    super(`Unsupported platform: ${platform}`);
  }
}

// Purchase
export class FailedToBuyProductError extends VoidhashError {}

export class ProductNotFoundError extends VoidhashError {}

export class PurchasePendingError extends VoidhashError {}

export class PurchaseCancelledError extends VoidhashError {}

export class UnknownVoidhashError extends VoidhashError {
  constructor(cause?: Error) {
    super("Unknown Voidhash error", cause);
  }
}
