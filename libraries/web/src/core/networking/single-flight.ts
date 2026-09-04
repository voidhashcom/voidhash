import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

/**
 * The registry is heterogeneous by nature — one map holds the in-flight run for
 * every key, whatever each of them resolves to — so the value type is erased on
 * the way in and restored on the way out. `run` is the only writer, and it
 * always pairs a key with the effect whose type the caller declared, which is
 * what makes the restoration sound.
 */
const make = Effect.sync(() => {
  const inFlight = MutableHashMap.empty<string, Deferred.Deferred<unknown, unknown>>();

  /**
   * Runs `work` under `key`, or joins the run already in progress for that key.
   * One in-flight request per key stops a foreground burst, or a retry after a
   * timeout, from fanning out into duplicate round trips.
   */
  const run = <A, E, R>(work: Effect.Effect<A, E, R>, key: string): Effect.Effect<A, E, R> =>
    Effect.suspend(() => {
      const existing = MutableHashMap.get(inFlight, key);
      if (Option.isSome(existing)) {
        // oxlint-disable-next-line effect/casting-awareness -- restores the type erased by the heterogeneous registry; see the note above `make`.
        return Deferred.await(existing.value) as Effect.Effect<A, E, R>;
      }

      const deferred = Deferred.makeUnsafe<unknown, unknown>();
      MutableHashMap.set(inFlight, key, deferred);

      return Effect.exit(work).pipe(
        // oxlint-disable-next-line effect/casting-awareness -- erases the type on the way into the heterogeneous registry; see the note above `make`.
        Effect.tap((exit) => Deferred.done(deferred, exit as Exit.Exit<unknown, unknown>)),
        Effect.flatMap((exit) =>
          Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
        ),
        // Runs on every outcome, interruption included. A leader whose fiber is
        // torn down would otherwise leave its joiners waiting on a deferred
        // nobody will ever settle, so it is completed before the key is freed.
        Effect.onExit((exit) =>
          Effect.andThen(
            Effect.sync(() => {
              // oxlint-disable-next-line effect/casting-awareness -- erases the type on the way into the heterogeneous registry; see the note above `make`.
              Deferred.doneUnsafe(deferred, Exit.asVoid(exit) as Exit.Exit<unknown, unknown>);
            }),
            Effect.sync(() => MutableHashMap.remove(inFlight, key)),
          ),
        ),
      );
    });

  return { run } as const;
});

export class SingleFlight extends Context.Service<SingleFlight, Effect.Success<typeof make>>()(
  "web-voidhash/SingleFlight",
) {
  static Default = Layer.effect(SingleFlight, make);
}
