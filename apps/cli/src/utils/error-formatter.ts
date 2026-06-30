import { CliError } from "effect/unstable/cli";
import { Cause, Console, Effect } from "effect";

const CliErrorTypeId = Symbol.for("~effect/cli/CliError");

/**
 * Check if debug mode is enabled via --debug flag
 */
export const isDebugMode = (): boolean =>
  process.argv.includes("--debug") || process.argv.includes("-d");

/**
 * Resolve the active config profile from the `--profile <name>` / `--profile=<name>`
 * flag, or `null` when no profile is requested.
 *
 * Like {@link isDebugMode}, this reads `process.argv` directly because the parsed
 * flag value isn't available where the CliConfig layer is built. The flag itself
 * is registered as a shared flag on the root command so the parser accepts it on
 * every command.
 */
export const getActiveProfile = (): string | null => {
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--profile") return argv[i + 1] ?? null;
    if (arg.startsWith("--profile=")) {
      return arg.slice("--profile=".length) || null;
    }
  }
  return null;
};

/**
 * Creates a CliError.UserError with a message.
 * Use this in command error handlers to show user-friendly errors.
 *
 * @example
 * ```ts
 * Effect.catchTag("NoSignedInUserError", () =>
 *   Effect.fail(userError("You must be logged in. Run 'voidhash-cli auth login' first."))
 * )
 * ```
 */
export const userError = (message: string): CliError.UserError =>
  new CliError.UserError({ cause: new Error(message) });

/**
 * Check if an error is a CliError from @effect/cli
 */
const isCliError = (error: unknown): error is CliError.CliError =>
  typeof error === "object" && error !== null && CliErrorTypeId in error;

/**
 * Wraps a CLI effect to properly render CliErrors.
 *
 * @effect/cli's Command.run doesn't render CliErrors that bubble up
 * from command handlers - it only handles them during parsing.
 * This wrapper catches those errors and prints them nicely, then exits with code 1.
 *
 * In debug mode, it also logs the full error cause chain before the user-friendly message.
 */
export const withValidationErrorHandler = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A | void, Exclude<E, CliError.CliError>, R> =>
  effect.pipe(
    Effect.catchCause((cause) => {
      const failures = cause.reasons
        .filter((r): r is Extract<typeof r, { _tag: "Fail" }> => r._tag === "Fail")
        .map((r) => r.error);

      for (const failure of failures) {
        if (isCliError(failure)) {
          // In debug mode, show the full cause chain
          if (isDebugMode()) {
            return Console.error("\n--- Debug Trace ---").pipe(
              Effect.andThen(Console.error(Cause.pretty(cause))),
              Effect.andThen(Console.error("--- End Debug Trace ---\n")),
              Effect.andThen(Console.error(failure.message)),
              Effect.andThen(Effect.sync(() => process.exit(1))),
            );
          }

          // Normal mode: just show the user-friendly message
          return Console.error(failure.message).pipe(
            Effect.andThen(Effect.sync(() => process.exit(1))),
          );
        }
      }

      // For non-CliError failures, show full cause in debug mode
      if (isDebugMode() && cause.reasons.length > 0) {
        return Console.error("\n--- Debug Trace ---").pipe(
          Effect.andThen(Console.error(Cause.pretty(cause))),
          Effect.andThen(Console.error("--- End Debug Trace ---\n")),
          Effect.andThen(Effect.sync(() => process.exit(1))),
        );
      }

      // Re-fail with non-CliError
      const firstFailure = failures[0];
      if (firstFailure !== undefined) {
        return Effect.fail(firstFailure as Exclude<E, CliError.CliError>);
      }

      // Handle defects
      return Effect.failCause(cause as Cause.Cause<Exclude<E, CliError.CliError>>);
    }),
  );
