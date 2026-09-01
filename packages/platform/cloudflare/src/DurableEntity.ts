import type {
  DurableEntityAddress,
  DurableEntityAlarm,
  DurableEntityHostShape,
  DurableEntityKeyValue,
  DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import type * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

/** First-party storage capabilities backed by one Durable Object instance. */
export interface CloudflareDurableEntityStorage {
  readonly keyValue: DurableEntityKeyValue;
  readonly alarm: DurableEntityAlarm;
}

/** Adapts Durable Object KV and alarm storage to the first-party entity contract. */
export const makeCloudflareDurableEntityStorage = (
  storage: Cloudflare.DurableObjectStorage,
  runtimeContext: RuntimeContext["Service"],
): CloudflareDurableEntityStorage => ({
  keyValue: {
    get: (key) =>
      storage
        .get<unknown>(key)
        .pipe(
          Effect.map(Option.fromUndefinedOr),
          Effect.provideService(RuntimeContext, runtimeContext),
        ),
    put: (key, value) =>
      storage.put(key, value).pipe(Effect.provideService(RuntimeContext, runtimeContext)),
    delete: (key) =>
      storage.delete(key).pipe(Effect.provideService(RuntimeContext, runtimeContext)),
  },
  alarm: {
    get: storage
      .getAlarm()
      .pipe(
        Effect.map(Option.fromNullishOr),
        Effect.provideService(RuntimeContext, runtimeContext),
      ),
    set: (scheduledTime) =>
      storage.setAlarm(scheduledTime).pipe(Effect.provideService(RuntimeContext, runtimeContext)),
    delete: storage.deleteAlarm().pipe(Effect.provideService(RuntimeContext, runtimeContext)),
  },
});

/** Adapts a hibernatable Cloudflare socket to the portable entity session contract. */
export const makeCloudflareDurableEntitySession = (
  id: string,
  socket: Cloudflare.WebSocket,
): DurableEntitySession => ({
  id,
  send: (message) => socket.send(message),
  close: (code = 1000, reason = "") => socket.close(code, reason),
  getAttachment: Effect.sync(() => {
    const attachment = socket.deserializeAttachment();
    return Option.isOption(attachment) ? attachment : Option.fromUndefinedOr(attachment);
  }),
  setAttachment: (attachment) => Effect.sync(() => socket.serializeAttachment(attachment)),
});

/** Creates a serialized portable entity host over one Durable Object instance. */
export const makeCloudflareDurableEntityHost = (
  state: Cloudflare.DurableObjectState["Service"],
  runtimeContext: RuntimeContext["Service"],
  localAddress: DurableEntityAddress,
  sessions: Map<string, DurableEntitySession>,
): DurableEntityHostShape => {
  const lock = Semaphore.makeUnsafe(1);
  const storage = makeCloudflareDurableEntityStorage(state.storage, runtimeContext);
  return {
    run: (address, operation) => {
      if (address.type !== localAddress.type || address.id !== localAddress.id) {
        return Effect.die(
          new DurableEntityAddressMismatch({
            message: `Durable Object ${localAddress.type}/${localAddress.id} cannot host ${address.type}/${address.id}`,
          }),
        );
      }
      return lock.withPermit(
        Effect.suspend(() =>
          operation({
            address: localAddress,
            ...storage,
            sessions: {
              get: (id) => Effect.sync(() => Option.fromUndefinedOr(sessions.get(id))),
              list: Effect.sync(() => [...sessions.values()]),
              attach: (session) => Effect.sync(() => void sessions.set(session.id, session)),
              remove: (id) => Effect.sync(() => void sessions.delete(id)),
            },
            sql: Option.none(),
          }),
        ),
      );
    },
  };
};

class DurableEntityAddressMismatch extends Schema.TaggedErrorClass<DurableEntityAddressMismatch>()(
  "DurableEntityAddressMismatch",
  { message: Schema.String },
) {}
