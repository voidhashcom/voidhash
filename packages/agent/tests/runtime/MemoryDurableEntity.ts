import {
  DurableEntityHost,
  type DurableEntityContext,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@orbian/sdk/DurableEntity";
import { Effect, Layer, Semaphore } from "effect";

interface MemoryEntityState {
  readonly lock: Semaphore.Semaphore;
  readonly values: Map<string, unknown>;
  readonly sessions: Map<string, DurableEntitySession>;
  alarm: number | undefined;
}

const entityKey = (type: string, id: string): string => `${type}\u0000${id}`;

/**
 * Builds an isolated in-memory durable entity host. Operations for one address
 * are FIFO-serialized; different addresses may run concurrently.
 */
export const makeMemoryDurableEntityHost = (): DurableEntityHostShape => {
  const states = new Map<string, MemoryEntityState>();

  const stateFor = (type: string, id: string): MemoryEntityState => {
    const key = entityKey(type, id);
    let state = states.get(key);
    if (!state) {
      state = {
        lock: Semaphore.makeUnsafe(1),
        values: new Map(),
        sessions: new Map(),
        alarm: undefined,
      };
      states.set(key, state);
    }
    return state;
  };

  return DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address.type, address.id);
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
            delete: Effect.sync(() => void (state.alarm = undefined)),
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
};

/** In-memory entity host layer for tests and ephemeral local development. */
export const MemoryDurableEntityHostLive: Layer.Layer<DurableEntityHost> = Layer.sync(
  DurableEntityHost,
  makeMemoryDurableEntityHost,
);
