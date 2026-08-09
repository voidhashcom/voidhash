export class VoidhashNodeConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
