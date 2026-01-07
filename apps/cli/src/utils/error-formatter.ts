import { HelpDoc, ValidationError } from "@effect/cli";
import * as Span from "@effect/cli/HelpDoc/Span";
import { Cause, Chunk, Console, Effect } from "effect";

const ValidationErrorTypeId = Symbol.for("@effect/cli/ValidationError");

/**
 * Check if debug mode is enabled via --debug flag
 */
export const isDebugMode = (): boolean =>
  process.argv.includes("--debug") || process.argv.includes("-d");

/**
 * Creates a nicely formatted error HelpDoc with red styling.
 */
export const errorDoc = (message: string): HelpDoc.HelpDoc =>
  HelpDoc.p(Span.error(message));

/**
 * Creates a ValidationError with a nicely formatted red error message.
 * Use this in command error handlers to show user-friendly errors.
 *
 * @example
 * ```ts
 * Effect.catchTag("NoSignedInUserError", () =>
 *   Effect.fail(userError("You must be logged in. Run 'voidhash auth login' first."))
 * )
 * ```
 */
export const userError = (message: string): ValidationError.ValidationError =>
  ValidationError.invalidValue(errorDoc(message));

/**
 * Check if an error is a ValidationError from @effect/cli
 */
const isValidationError = (
  error: unknown
): error is ValidationError.ValidationError =>
  typeof error === "object" && error !== null && ValidationErrorTypeId in error;

/**
 * Wraps a CLI effect to properly render ValidationErrors.
 *
 * @effect/cli's Command.run doesn't render ValidationErrors that bubble up
 * from command handlers - it only handles them during parsing.
 * This wrapper catches those errors and prints them nicely, then exits with code 1.
 *
 * In debug mode, it also logs the full error cause chain before the user-friendly message.
 */
export const withValidationErrorHandler = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A | void, Exclude<E, ValidationError.ValidationError>, R> =>
  effect.pipe(
    Effect.catchAllCause((cause) => {
      const failures = Cause.failures(cause);

      for (const failure of failures) {
        if (isValidationError(failure)) {
          // In debug mode, show the full cause chain
          if (isDebugMode()) {
            return Console.error("\n--- Debug Trace ---").pipe(
              Effect.andThen(
                Console.error(Cause.pretty(cause, { renderErrorCause: true }))
              ),
              Effect.andThen(Console.error("--- End Debug Trace ---\n")),
              Effect.andThen(Console.error(HelpDoc.toAnsiText(failure.error))),
              Effect.andThen(Effect.sync(() => process.exit(1)))
            );
          }

          // Normal mode: just show the user-friendly message
          return Console.error(HelpDoc.toAnsiText(failure.error)).pipe(
            Effect.andThen(Effect.sync(() => process.exit(1)))
          );
        }
      }

      // For non-ValidationError failures, show full cause in debug mode
      if (isDebugMode() && !Cause.isEmpty(cause)) {
        return Console.error("\n--- Debug Trace ---").pipe(
          Effect.andThen(
            Console.error(Cause.pretty(cause, { renderErrorCause: true }))
          ),
          Effect.andThen(Console.error("--- End Debug Trace ---\n")),
          Effect.andThen(Effect.sync(() => process.exit(1)))
        );
      }

      // Re-fail with non-ValidationError
      const firstFailure = Chunk.head(failures);
      if (firstFailure._tag === "Some") {
        return Effect.fail(
          firstFailure.value as Exclude<E, ValidationError.ValidationError>
        );
      }

      // Handle defects
      return Effect.failCause(
        cause as Cause.Cause<Exclude<E, ValidationError.ValidationError>>
      );
    })
  );
