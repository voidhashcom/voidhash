import {
  DurableEntityAlarmControl,
  type DurableEntityAlarmControlShape,
  type DurableEntityAddress,
  type DurableEntityContext,
  DurableEntityHost,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import { Context, Effect, Layer, Semaphore } from "effect";

interface MemoryEntityState {
  readonly address: DurableEntityAddress;
  readonly lock: Semaphore.Semaphore;
  readonly values: Map<string, unknown>;
  readonly sessions: Map<string, DurableEntitySession>;
  alarm: number | undefined;
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
  const states = new Map<string, MemoryEntityState>();

  const stateFor = (address: DurableEntityAddress): MemoryEntityState => {
    const key = entityKey(address.type, address.id);
    let state = states.get(key);
    if (!state) {
      state = {
        address,
        lock: Semaphore.makeUnsafe(1),
        values: new Map(),
        sessions: new Map(),
        alarm: undefined,
      };
      states.set(key, state);
    }
    return state;
  };

  const host = DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address);
        const context: DurableEntityContext = {
          address,
          keyValue: {
            get: (key) => Effect.sync(() => state.values.get(key)),
            put: (key, value) => Effect.sync(() => void state.values.set(key, value)),
            delete: (key) => Effect.sync(() => void state.values.delete(key)),
          },
          alarm: {
            get: Effect.sync(() => state.alarm),
            set: (scheduledTime) => Effect.sync(() => void (state.alarm = scheduledTime)),
            delete: Effect.sync(() => (state.alarm = undefined)),
          },
          sessions: {
            get: (sessionId) => Effect.sync(() => state.sessions.get(sessionId)),
            list: Effect.sync(() => [...state.sessions.values()]),
            attach: (session) => Effect.sync(() => void state.sessions.set(session.id, session)),
            remove: (sessionId) => Effect.sync(() => void state.sessions.delete(sessionId)),
          },
        };
        return state.lock.withPermit(Effect.suspend(() => operation(context)));
      }),
  });

  const control = DurableEntityAlarmControl.of({
    listDueAlarms: (now, limit) =>
      Effect.sync(() =>
        [...states.values()]
          .flatMap((state) => {
            if (state.alarm === undefined || state.alarm > now) return [];
            return [{ address: state.address, scheduledTime: state.alarm }];
          })
          .sort((left, right) => left.scheduledTime - right.scheduledTime)
          .slice(0, Math.max(0, Math.floor(limit))),
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
