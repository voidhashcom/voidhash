import { CliError } from "effect/unstable/cli";
import { Cause, Console, Data, Effect } from "effect";

const CliErrorTypeId = Symbol.for("~effect/cli/CliError");

/**
 * Check if debug mode is enabled via --debug flag
 */
export const isDebugMode = (): boolean =>
  // oxlint-disable-next-line effect/noGlobals -- synchronous argv adapter: `--debug` must be readable where the CliConfig layer is built, before the parsed flag values exist, so the effect-based `CommandExecutor`/`Config` path is not available yet.
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
  // oxlint-disable-next-line effect/noGlobals -- as documented above, the `--profile` value is read straight from argv because the parsed flag isn't available where the CliConfig layer is built.
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
/**
 * The cause carried by a {@link userError} — an ordinary `Error` (so
 * `Cause.pretty` renders it) whose only payload is the user-facing message.
 */
export class UserMessageError extends Data.TaggedError("UserMessageError")<{
  readonly message: string;
}> {}

export const userError = (message: string): CliError.UserError =>
  new CliError.UserError({ cause: new UserMessageError({ message }) });

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
              // oxlint-disable-next-line effect/noGlobals -- terminal CLI exit: this handler wraps the whole program, so there is no outer Effect runtime left to carry an exit code; failing instead would re-print the cause the handler just rendered.
              Effect.andThen(Effect.sync(() => process.exit(1))),
            );
          }

          // Normal mode: just show the user-friendly message
          return Console.error(failure.message).pipe(
            // oxlint-disable-next-line effect/noGlobals -- terminal CLI exit: this handler wraps the whole program, so there is no outer Effect runtime left to carry an exit code; failing instead would re-print the message just rendered.
            Effect.andThen(Effect.sync(() => process.exit(1))),
          );
        }
      }

      // For non-CliError failures, show full cause in debug mode
      if (isDebugMode() && cause.reasons.length > 0) {
        return Console.error("\n--- Debug Trace ---").pipe(
          Effect.andThen(Console.error(Cause.pretty(cause))),
          Effect.andThen(Console.error("--- End Debug Trace ---\n")),
          // oxlint-disable-next-line effect/noGlobals -- terminal CLI exit: this debug-mode handler wraps the whole program, so there is no outer Effect runtime left to carry an exit code; failing instead would re-print the trace just rendered.
          Effect.andThen(Effect.sync(() => process.exit(1))),
        );
      }

      // Re-fail with non-CliError. Every CliError already returned above, so
      // whatever is left in `failures` is outside the excluded union.
      const firstFailure = failures.find(
        (failure): failure is Exclude<E, CliError.CliError> => !isCliError(failure),
      );
      if (firstFailure !== undefined) {
        return Effect.fail(firstFailure);
      }

      // Handle defects
      const defects = cause.reasons.filter(
        (reason): reason is Cause.Die | Cause.Interrupt => reason._tag !== "Fail",
      );
      return Effect.failCause(Cause.fromReasons(defects));
    }),
  );
