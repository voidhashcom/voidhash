import { Data } from "effect";

/**
 * Base error for paywall design storage operations
 */
export class PaywallDesignStorageError extends Data.TaggedError(
  "PaywallDesignStorageError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when Redis operations fail
 */
export class RedisOperationError extends Data.TaggedError("RedisOperationError")<{
  readonly operation: "get" | "set" | "delete" | "connect";
  readonly paywallId?: string;
  readonly cause?: unknown;
}> {
  override get message(): string {
    const base = `Redis ${this.operation} operation failed`;
    return this.paywallId ? `${base} for paywall ${this.paywallId}` : base;
  }
}

/**
 * Error when MySQL snapshot operations fail
 */
export class MySqlSnapshotError extends Data.TaggedError("MySqlSnapshotError")<{
  readonly operation: "load" | "save" | "delete";
  readonly paywallId: string;
  readonly cause?: unknown;
}> {
  override get message(): string {
    return `MySQL ${this.operation} failed for paywall ${this.paywallId}`;
  }
}

/**
 * Error when S3 publish operations fail
 */
export class S3PublishError extends Data.TaggedError("S3PublishError")<{
  readonly operation: "upload" | "download" | "list";
  readonly paywallId: string;
  readonly cause?: unknown;
}> {
  override get message(): string {
    return `S3 ${this.operation} failed for paywall ${this.paywallId}`;
  }
}

/**
 * Error when schema migration fails
 */
export class SchemaMigrationError extends Data.TaggedError(
  "SchemaMigrationError"
)<{
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly cause?: unknown;
}> {
  override get message(): string {
    return `Schema migration from v${this.fromVersion} to v${this.toVersion} failed`;
  }
}

/**
 * Error when optimistic locking fails (version mismatch)
 */
export class VersionConflictError extends Data.TaggedError(
  "VersionConflictError"
)<{
  readonly paywallId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
}> {
  override get message(): string {
    return `Version conflict for paywall ${this.paywallId}: expected v${this.expectedVersion}, got v${this.actualVersion}`;
  }
}

/**
 * Error when paywall design state is not found
 */
export class DesignStateNotFoundError extends Data.TaggedError(
  "DesignStateNotFoundError"
)<{
  readonly paywallId: string;
}> {
  override get message(): string {
    return `Design state not found for paywall ${this.paywallId}`;
  }
}
