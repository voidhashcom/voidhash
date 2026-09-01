import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

class UnsafeBoundaryError extends Schema.TaggedErrorClass<UnsafeBoundaryError>(
  "UnsafeBoundaryError",
)("UnsafeBoundaryError", { message: Schema.String }) {}

/** Typed defect used when an internal invariant is violated. */
export class UnexpectedCoreError extends Schema.TaggedErrorClass<UnexpectedCoreError>(
  "UnexpectedCoreError",
)("UnexpectedCoreError", { message: Schema.String }) {}

/** Constructs a typed internal-invariant defect. */
export const unexpectedError = (message: string): UnexpectedCoreError =>
  new UnexpectedCoreError({ message });

/** Runs a promise whose rejection is an unrecoverable boundary defect. */
export const promiseOrDie = <A>(evaluate: () => PromiseLike<A>): Effect.Effect<A> =>
  Effect.tryPromise({
    try: evaluate,
    catch: (cause) => unexpectedError(String(cause)),
  }).pipe(Effect.orDie);

/** Synchronous Effect runtime entrypoint for tests and process boundaries. */
export const runSync = <A, E>(effect: Effect.Effect<A, E>): A =>
  Exit.match(Effect.runSyncExit(effect), {
    onFailure: (cause) => {
      throw Cause.squash(cause);
    },
    onSuccess: (value) => value,
  });

/** Asynchronous Effect runtime entrypoint for tests and process boundaries. */
export const runPromise = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromiseExit(effect).then(
    Exit.match({
      onFailure: (cause) => Promise.reject(Cause.squash(cause)),
      onSuccess: (value) => value,
    }),
  );

/** Unwraps an Option only at a test or invariant boundary. */
export const unsafeOption = <A>(value: Option.Option<A>): A => {
  if (Option.isSome(value)) return value.value;
  throw new UnsafeBoundaryError({ message: "Expected Option.Some" });
};

/** Unwraps a Result only at a test or invariant boundary. */
export const unsafeResult = <A, E>(value: Result.Result<A, E>): A => {
  if (Result.isSuccess(value)) return value.success;
  throw new UnsafeBoundaryError({ message: "Expected Result.Success" });
};

/** Synchronous environment adapter for legacy startup and test boundaries. */
export const processEnvironment = process["env"];

/** Recovers a deliberately best-effort boundary with an explicit fallback. */
export const recoverAll = <A2>(fallback: () => A2) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A | A2, never, R> =>
    Effect.matchEffect(effect, {
      onFailure: () => Effect.succeed(fallback()),
      onSuccess: Effect.succeed,
    });
