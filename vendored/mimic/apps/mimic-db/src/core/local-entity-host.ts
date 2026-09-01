import {
  DurableEntityHost,
  type DurableEntityContext,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";

interface MemoryEntityState {
  readonly lock: Semaphore.Semaphore;
  values: HashMap.HashMap<string, unknown>;
  sessions: HashMap.HashMap<string, DurableEntitySession>;
  alarm: Option.Option<number>;
}

const entityKey = (type: string, id: string): string => `${type}\u0000${id}`;

/**
 * Builds an isolated in-memory durable entity host for local development and
 * tests. Operations for one address are FIFO-serialized; different addresses
 * use independent semaphores and may run concurrently.
 */
export const makeMemoryDurableEntityHost = (): DurableEntityHostShape => {
  let states = HashMap.empty<string, MemoryEntityState>();

  const stateFor = (type: string, id: string): MemoryEntityState => {
    const key = entityKey(type, id);
    let state = Option.getOrUndefined(HashMap.get(states, key));
    if (!state) {
      state = {
        lock: Semaphore.makeUnsafe(1),
        values: HashMap.empty(),
        sessions: HashMap.empty(),
        alarm: Option.none(),
      };
      states = HashMap.set(states, key, state);
    }
    return state;
  };

  return DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address.type, address.id);
        const context: DurableEntityContext = {
          address,
          sql: Option.none(),
          keyValue: {
            get: (key) => Effect.sync(() => HashMap.get(state.values, key)),
            put: (key, value) =>
              Effect.sync(() => void (state.values = HashMap.set(state.values, key, value))),
            delete: (key) =>
              Effect.sync(() => void (state.values = HashMap.remove(state.values, key))),
          },
          alarm: {
            get: Effect.sync(() => state.alarm),
            set: (scheduledTime) =>
              Effect.sync(() => void (state.alarm = Option.some(scheduledTime))),
            delete: Effect.sync(() => void (state.alarm = Option.none())),
          },
          sessions: {
            get: (sessionId) => Effect.sync(() => HashMap.get(state.sessions, sessionId)),
            list: Effect.sync(() => Array.from(HashMap.values(state.sessions))),
            attach: (session) =>
              Effect.sync(
                () => void (state.sessions = HashMap.set(state.sessions, session.id, session)),
              ),
            remove: (sessionId) =>
              Effect.sync(() => void (state.sessions = HashMap.remove(state.sessions, sessionId))),
          },
        };
        return state.lock.withPermit(Effect.suspend(() => operation(context)));
      }),
  });
};

/** In-memory entity host layer for local development and tests. */
export const MemoryDurableEntityHostLive: Layer.Layer<DurableEntityHost> = Layer.sync(
  DurableEntityHost,
  makeMemoryDurableEntityHost,
);
