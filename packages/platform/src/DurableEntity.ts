import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

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
  readonly getAttachment: Effect.Effect<Option.Option<unknown>>;
  readonly setAttachment: (attachment: unknown) => Effect.Effect<void>;
}

/** Entity-local key-value storage. */
export interface DurableEntityKeyValue {
  readonly get: (key: string) => Effect.Effect<Option.Option<unknown>>;
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
  readonly get: Effect.Effect<Option.Option<number>>;
  readonly set: (scheduledTime: number) => Effect.Effect<void>;
  readonly delete: Effect.Effect<void>;
}

/** A persisted alarm whose scheduled time has arrived. */
export interface DueDurableEntityAlarm {
  readonly address: DurableEntityAddress;
  readonly scheduledTime: number;
}

/** Control plane a scheduler polls to find the entities whose alarms are due. */
export interface DurableEntityAlarmControlShape {
  readonly listDueAlarms: (
    now: number,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<DueDurableEntityAlarm>>;
}

/**
 * Exposes persisted alarms to an out-of-band dispatcher.
 *
 * Runtimes whose entity storage fires alarms by itself (Cloudflare Durable
 * Objects) never publish this service; runtimes whose storage cannot enumerate
 * pending alarms have to, or an armed alarm can never fire.
 */
export class DurableEntityAlarmControl extends Context.Service<
  DurableEntityAlarmControl,
  DurableEntityAlarmControlShape
>()("@voidhash/platform/DurableEntityAlarmControl") {}

/** Live sessions currently attached to an entity instance. */
export interface DurableEntitySessions {
  readonly get: (sessionId: string) => Effect.Effect<Option.Option<DurableEntitySession>>;
  readonly list: Effect.Effect<ReadonlyArray<DurableEntitySession>>;
  readonly attach: (session: DurableEntitySession) => Effect.Effect<void>;
  readonly remove: (sessionId: string) => Effect.Effect<void>;
}

/** Capabilities visible while one entity operation holds its serialized turn. */
export interface DurableEntityContext {
  readonly address: DurableEntityAddress;
  readonly keyValue: DurableEntityKeyValue;
  readonly sql: Option.Option<DurableEntitySql>;
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
