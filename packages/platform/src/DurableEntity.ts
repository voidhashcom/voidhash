import { Context, type Effect } from "effect";

/** Stable identity of one durable entity instance. */
export interface DurableEntityAddress {
  readonly type: string;
  readonly id: string;
}

/** Runtime-neutral WebSocket session attached to an entity. */
export interface DurableEntitySession {
  readonly id: string;
  readonly send: (message: string | Uint8Array) => Effect.Effect<void>;
  readonly close: (code?: number, reason?: string) => Effect.Effect<void>;
  readonly getAttachment: Effect.Effect<unknown | undefined>;
  readonly setAttachment: (attachment: unknown) => Effect.Effect<void>;
}

/** Entity-local key-value storage. */
export interface DurableEntityKeyValue {
  readonly get: (key: string) => Effect.Effect<unknown | undefined>;
  readonly put: (key: string, value: unknown) => Effect.Effect<void>;
  readonly delete: (key: string) => Effect.Effect<void>;
}

/** Optional embedded SQL store supplied by adapters that support it. */
export interface DurableEntitySql {
  readonly execute: <Row extends Readonly<Record<string, unknown>>>(
    statement: string,
    bindings?: ReadonlyArray<unknown>,
  ) => Effect.Effect<ReadonlyArray<Row>>;
}

/** One replaceable persisted alarm for an entity. */
export interface DurableEntityAlarm {
  readonly get: Effect.Effect<number | undefined>;
  readonly set: (scheduledTime: number) => Effect.Effect<void>;
  readonly delete: Effect.Effect<void>;
}

/** Live sessions currently attached to an entity instance. */
export interface DurableEntitySessions {
  readonly get: (sessionId: string) => Effect.Effect<DurableEntitySession | undefined>;
  readonly list: Effect.Effect<ReadonlyArray<DurableEntitySession>>;
  readonly attach: (session: DurableEntitySession) => Effect.Effect<void>;
  readonly remove: (sessionId: string) => Effect.Effect<void>;
}

/** Capabilities visible while one entity operation holds its serialized turn. */
export interface DurableEntityContext {
  readonly address: DurableEntityAddress;
  readonly keyValue: DurableEntityKeyValue;
  readonly sql?: DurableEntitySql;
  readonly alarm: DurableEntityAlarm;
  readonly sessions: DurableEntitySessions;
}

/** First-party host contract for identity-addressed, serialized entity execution. */
export interface DurableEntityHostShape {
  readonly run: <A, E, R>(
    address: DurableEntityAddress,
    operation: (context: DurableEntityContext) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>;
}

/**
 * Hosts durable entity operations without exposing Cloudflare or single-node
 * runtime types to application code.
 */
export class DurableEntityHost extends Context.Service<DurableEntityHost, DurableEntityHostShape>()(
  "@voidhash/platform/DurableEntityHost",
) {}

/** Creates a stable entity address in first-party vocabulary. */
export const makeDurableEntityAddress = (type: string, id: string): DurableEntityAddress => ({
  type,
  id,
});
