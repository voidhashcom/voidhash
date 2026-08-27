export class MimicClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MimicClientError";
  }
}

export class NotConnectedError extends MimicClientError {
  constructor() {
    super("Transport is not connected");
    this.name = "NotConnectedError";
  }
}

export class InvalidStateError extends MimicClientError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class TransportError extends MimicClientError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "TransportError";
    this.cause = cause;
  }
}

export class ProtocolError extends MimicClientError {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

export class SnapshotValidationError extends MimicClientError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SnapshotValidationError";
    this.cause = cause;
  }
}

export class TransactionRejectedError extends MimicClientError {
  readonly transactionId: string;
  readonly reason: string;

  constructor(transactionId: string, reason: string) {
    super(`Transaction ${transactionId} rejected: ${reason}`);
    this.name = "TransactionRejectedError";
    this.transactionId = transactionId;
    this.reason = reason;
  }
}
