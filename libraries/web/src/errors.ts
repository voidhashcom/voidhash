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

/** A method was called with an argument it cannot use; nothing was changed or sent. */
export class VoidhashInvalidArgumentError extends VoidhashError {}

export class VoidhashNotInitializedError extends VoidhashError {
  constructor(message = "Voidhash client has not been initialized.") {
    super(message);
  }
}

export class VoidhashDestroyedError extends VoidhashError {
  constructor() {
    super("Voidhash client has already been destroyed.");
  }
}

export class VoidhashFeatureFlagsError extends VoidhashError {}
