import {
  DurableEntityAlarmControl,
  type DurableEntityAlarmControlShape,
  type DurableEntityAddress,
  type DurableEntityContext,
  type DueDurableEntityAlarm,
  DurableEntityHost,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import * as Context from "effect/Context";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Semaphore from "effect/Semaphore";

interface MemoryEntityState {
  readonly address: DurableEntityAddress;
  readonly lock: Semaphore.Semaphore;
  readonly values: MutableHashMap.MutableHashMap<string, unknown>;
  readonly sessions: MutableHashMap.MutableHashMap<string, DurableEntitySession>;
  alarm: Option.Option<number>;
}

const entityKey = (type: string, id: string): string => `${type}\u0000${id}`;

/** An in-memory entity host paired with the control plane over its alarms. */
export interface MemoryDurableEntity {
  readonly host: DurableEntityHostShape;
  readonly control: DurableEntityAlarmControlShape;
}

/**
 * Builds an isolated in-memory durable entity host and its alarm control
 * plane. Operations for one address are FIFO-serialized; different addresses
 * may run concurrently.
 */
export const makeMemoryDurableEntity = (): MemoryDurableEntity => {
  const states = MutableHashMap.empty<string, MemoryEntityState>();

  const stateFor = (address: DurableEntityAddress): MemoryEntityState => {
    const key = entityKey(address.type, address.id);
    const state = MutableHashMap.get(states, key);
    if (Option.isSome(state)) return state.value;
    const created = {
      address,
      lock: Semaphore.makeUnsafe(1),
      values: MutableHashMap.empty<string, unknown>(),
      sessions: MutableHashMap.empty<string, DurableEntitySession>(),
      alarm: Option.none<number>(),
    };
    MutableHashMap.set(states, key, created);
    return created;
  };

  const host = DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address);
        const context: DurableEntityContext = {
          address,
          keyValue: {
            get: (key) => Effect.sync(() => MutableHashMap.get(state.values, key)),
            put: (key, value) =>
              Effect.sync(() => void MutableHashMap.set(state.values, key, value)),
            delete: (key) => Effect.sync(() => void MutableHashMap.remove(state.values, key)),
          },
          alarm: {
            get: Effect.sync(() => state.alarm),
            set: (scheduledTime) =>
              Effect.sync(() => void (state.alarm = Option.some(scheduledTime))),
            delete: Effect.sync(() => void (state.alarm = Option.none())),
          },
          sessions: {
            get: (sessionId) => Effect.sync(() => MutableHashMap.get(state.sessions, sessionId)),
            list: Effect.sync(() => [...MutableHashMap.values(state.sessions)]),
            attach: (session) =>
              Effect.sync(() => void MutableHashMap.set(state.sessions, session.id, session)),
            remove: (sessionId) =>
              Effect.sync(() => void MutableHashMap.remove(state.sessions, sessionId)),
          },
          sql: Option.none(),
        };
        return state.lock.withPermit(Effect.suspend(() => operation(context)));
      }),
  });

  const control = DurableEntityAlarmControl.of({
    listDueAlarms: (now, limit) =>
      Effect.sync(() =>
        Arr.sort(
          [...MutableHashMap.values(states)].flatMap((state) => {
            if (Option.isNone(state.alarm) || state.alarm.value > now) return [];
            return [{ address: state.address, scheduledTime: state.alarm.value }];
          }),
          Order.mapInput(Order.Number, (alarm: DueDurableEntityAlarm) => alarm.scheduledTime),
        ).slice(0, Math.max(0, Math.floor(limit))),
      ),
  });

  return { host, control };
};

/** Builds an isolated in-memory durable entity host. */
export const makeMemoryDurableEntityHost = (): DurableEntityHostShape =>
  makeMemoryDurableEntity().host;

/** In-memory entity host layer for tests and ephemeral local development. */
export const MemoryDurableEntityHostLive: Layer.Layer<
  DurableEntityHost | DurableEntityAlarmControl
> = Layer.syncContext(() => {
  const memory = makeMemoryDurableEntity();
  return Context.make(DurableEntityHost, memory.host).pipe(
    Context.add(DurableEntityAlarmControl, memory.control),
  );
});
