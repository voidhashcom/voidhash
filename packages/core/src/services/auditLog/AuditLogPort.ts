import {
  type AuditLogActionValue,
  type AuditLogActorTypeValue,
  type AuditLogEntityTypeValue,
} from "@voidhash/db";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export interface AuditLogAppendInput {
  readonly projectId: string;
  readonly entityType: AuditLogEntityTypeValue;
  readonly entityId: string;
  readonly parentEntityId?: string;
  readonly action: AuditLogActionValue;
  readonly actorType?: AuditLogActorTypeValue;
  readonly changes?: unknown;
  readonly metadata?: Record<string, unknown>;
}

/** Stable error exposed by the optional audit extension to core mutations. */
export class AuditLogPortError extends Schema.TaggedErrorClass<AuditLogPortError>(
  "AuditLogPortError",
)("AuditLogPortError", { cause: Schema.String }) {}

export interface AuditLogPortShape {
  /** Records an immutable audit event when the deployment enables auditing. */
  readonly append: (input: AuditLogAppendInput) => Effect.Effect<void, AuditLogPortError>;
}

/** Optional extension point used by core mutations to emit audit events. */
export class AuditLogPort extends Context.Service<AuditLogPort, AuditLogPortShape>()(
  "@voidhash/core/AuditLogPort",
) {
  /** Community layer for deployments without the enterprise audit extension. */
  static readonly noop: Layer.Layer<AuditLogPort> = Layer.succeed(AuditLogPort, {
    append: () => Effect.void,
  });
}
