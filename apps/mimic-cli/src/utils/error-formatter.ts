import { Cause, Console, Effect } from "effect";

export const isDebugMode = (): boolean =>
  process.argv.includes("--debug") || process.argv.includes("-d");

export const withErrorHandler = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A | void, never, R> =>
  effect.pipe(
    Effect.catchCause((cause) => {
      if (isDebugMode()) {
        return Console.error("\n--- Debug Trace ---").pipe(
          Effect.andThen(Console.error(Cause.pretty(cause))),
          Effect.andThen(Console.error("--- End Debug Trace ---\n")),
          Effect.andThen(Effect.sync(() => process.exit(1))),
        );
      }
      const error = Cause.squash(cause);
      return Console.error(`Error: ${error instanceof Error ? error.message : String(error)}`).pipe(
        Effect.andThen(Effect.sync(() => process.exit(1))),
      );
    }),
  );
