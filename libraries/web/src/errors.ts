export class VoidhashError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export class VoidhashConfigurationError extends VoidhashError {}

export class VoidhashNotInitializedError extends VoidhashError {
  constructor() {
    super("Voidhash client has not been initialized.");
  }
}

export class VoidhashDestroyedError extends VoidhashError {
  constructor() {
    super("Voidhash client has already been destroyed.");
  }
}

export class VoidhashStorageError extends VoidhashError {}

export class VoidhashFeatureFlagsError extends VoidhashError {}

export class VoidhashAnalyticsError extends VoidhashError {}

export class VoidhashIdentityError extends VoidhashError {}
