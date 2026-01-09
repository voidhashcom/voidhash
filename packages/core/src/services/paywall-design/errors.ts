import { Data } from "effect";

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
	"SchemaMigrationError",
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
	"VersionConflictError",
)<{
	readonly paywallId: string;
	readonly expectedVersion: number;
	readonly actualVersion: number;
}> {
	override get message(): string {
		return `Version conflict for paywall ${this.paywallId}: expected v${this.expectedVersion}, got v${this.actualVersion}`;
	}
}
