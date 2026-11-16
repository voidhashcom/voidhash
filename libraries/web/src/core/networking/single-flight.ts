import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

/**
 * The registry is heterogeneous by nature — one map holds the in-flight run for
 * every key, whatever each of them resolves to — so the value type is erased on
 * the way in and restored on the way out. `run` is the only writer, and it
 * always pairs a key with the effect whose type the caller declared, which is
 * what makes the restoration sound.
 */
export const makeSingleFlight = Effect.sync(() => {
  const inFlight = new Map<string, Deferred.Deferred<unknown, unknown>>();

  /**
   * Runs `work` under `key`, or joins the run already in progress for that key.
   * One in-flight request per key stops a foreground burst, or a retry after a
   * timeout, from fanning out into duplicate round trips.
   */
  const run = <A, E, R>(work: Effect.Effect<A, E, R>, key: string): Effect.Effect<A, E, R> =>
    Effect.suspend(() => {
      const existing = inFlight.get(key);
      if (existing !== undefined) {
        // oxlint-disable-next-line effect/casting-awareness -- restores the type erased by the heterogeneous registry; see the note above `make`.
        return Deferred.await(existing) as Effect.Effect<A, E, R>;
      }

      const deferred = Deferred.makeUnsafe<unknown, unknown>();
      inFlight.set(key, deferred);

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
            Effect.sync(() => inFlight.delete(key)),
          ),
        ),
      );
    });

  return { run } as const;
});

export class SingleFlight extends Context.Service<
  SingleFlight,
  Effect.Success<typeof makeSingleFlight>
>()("web-voidhash/SingleFlight") {}
