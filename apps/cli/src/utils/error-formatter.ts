import type { VoidhashCoreClientError } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { CliError, CliOutput } from "effect/cli";
import { HttpClientError, type HttpClientResponse } from "effect/http";

import { printable } from "./printable";

/**
 * Check if debug mode is enabled via --debug flag
 */
export const isDebugMode = (): boolean =>
  // oxlint-disable-next-line effect/noGlobals -- synchronous argv adapter: `--debug` must be readable where the CliConfig layer is built, before the parsed flag values exist, so the effect-based `CommandExecutor`/`Config` path is not available yet.
  process.argv.includes("--debug") || process.argv.includes("-d");

/**
 * Resolve the active config profile from the `--profile <name>` / `--profile=<name>`
 * flag, or `Option.none` when no profile is requested.
 *
 * Like {@link isDebugMode}, this reads `process.argv` directly because the parsed
 * flag value isn't available where the CliConfig layer is built. The flag itself
 * is registered as a shared flag on the root command so the parser accepts it on
 * every command.
 */
export const getActiveProfile = (): Option.Option<string> => {
  // oxlint-disable-next-line effect/noGlobals -- as documented above, the `--profile` value is read straight from argv because the parsed flag isn't available where the CliConfig layer is built.
  const argv = process.argv;
  return Arr.findFirst(argv, (arg, index) => {
    if (arg === "--profile") return Option.fromNullishOr(argv[index + 1]);
    if (arg.startsWith("--profile=")) {
      return Option.liftPredicate(Str.isNonEmpty)(arg.slice("--profile=".length));
    }
    return Option.none();
  });
};

/**
 * The exit codes scripts can rely on. Every failure the CLI reports exits with
 * one of these; a help request exits with 0 and an interrupted command with 130.
 */
export const ExitCode = {
  /** The command failed. */
  failure: 1,
  /**
   * The command was used wrongly: a missing or ambiguous argument, an invalid
   * flag, a request the API rejected as invalid, or a confirmation it needs
   * but cannot ask for.
   */
  usage: 2,
  /** No one is signed in, or the API no longer accepts the stored key. */
  unauthenticated: 3,
  /** What the command names does not exist, or the credential cannot see it. */
  notFound: 4,
} as const;
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * The cause carried by a {@link userError}: an ordinary `Error` (so
 * `Cause.pretty` renders it) holding the message and the exit code.
 */
export class UserMessageError extends Schema.TaggedError<UserMessageError>("UserMessageError")(
  "UserMessageError",
  { message: Schema.String, exitCode: Schema.optional(Schema.Int) },
) {}

/**
 * A failure the CLI shows the person and exits with. Say what happened and
 * why in `message`; put the next command to run in `hint`. The CLI prints
 * both under `ERROR` on standard error, as {@link printable} lines since they
 * may quote the server, and exits with `exitCode` ({@link ExitCode.failure}
 * unless given).
 *
 * @example
 * ```ts
 * Effect.fail(
 *   userError(`No product is named "${input}".`, {
 *     hint: "'voidhash-cli product list' shows them.",
 *     exitCode: ExitCode.notFound,
 *   }),
 * )
 * ```
 */
export const userError = (
  message: string,
  options: { readonly hint?: string; readonly exitCode?: ExitCode } = {},
): CliError.UserError =>
  new CliError.UserError({
    cause: new UserMessageError({
      // The formatter indents the first line under ERROR; the others follow it.
      message: [
        message,
        ...(options.hint === undefined || options.hint === "" ? [] : [options.hint]),
      ]
        .join("\n")
        .split("\n")
        .map(printable)
        .join("\n  "),
      exitCode: options.exitCode,
    }),
  });

/** A {@link userError}'s message and hint on one line, for a command that reports several failures together. */
export const userErrorLine = (error: CliError.UserError): string =>
  Schema.is(UserMessageError)(error.cause)
    ? error.cause.message
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
    : String(error.cause);

/** Every failure a call through the generated API client can end in. */
export type ApiFailure = HttpClientError.HttpClientError | VoidhashCoreClientError<string, unknown>;

/** Whether `error` is a failed call of the generated API client. */
export const isApiFailure = (error: unknown): error is ApiFailure =>
  HttpClientError.isHttpClientError(error) ||
  (P.isError(error) &&
    error.name === "VoidhashCoreClientError" &&
    P.hasProperty(error, "response") &&
    P.hasProperty(error, "data"));

/** The API's error envelope, `{ error: { type, code, message, param? } }`. */
const ApiErrorEnvelope = Schema.Struct({
  error: Schema.Struct({
    type: Schema.String,
    code: Schema.String,
    message: Schema.String,
    param: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
const decodeEnvelope = Schema.decodeUnknownOption(ApiErrorEnvelope);
const decodeEnvelopeJson = Schema.decodeUnknownOption(Schema.fromJsonString(ApiErrorEnvelope));

/**
 * The error `code` the API answered `error` with, such as `"product_slug_taken"`,
 * for a command that handles one failure itself.
 */
export const apiErrorCode = (error: ApiFailure): Option.Option<string> =>
  HttpClientError.isHttpClientError(error)
    ? Option.none()
    : Option.map(decodeEnvelope(error.data), (envelope) => envelope.error.code);

/**
 * `effect`'s result, or none when the caller's access does not include it
 * (`permission_denied`). For the parts of a combined view a person may not
 * see: show what they can and say what is not shown, instead of failing.
 */
export const ifPermitted = <A, E extends ApiFailure, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.map(Option.some),
    Effect.catchIf(
      (error) => Option.contains(apiErrorCode(error), "permission_denied"),
      () => Effect.succeedNone,
    ),
  );

/** What each error `type` tells the person to do next, and the exit code it ends in. */
const ERROR_TYPES: Readonly<
  Record<
    string,
    { readonly hint?: string; readonly exitCode: ExitCode; readonly isUnexpected?: true }
  >
> = {
  invalid_request: { exitCode: ExitCode.usage },
  unauthenticated: {
    hint: "Sign in again with 'voidhash-cli auth login'.",
    exitCode: ExitCode.unauthenticated,
  },
  permission_denied: {
    hint: "Your role cannot do this here, or the CLI is read-only on this computer; 'voidhash-cli whoami' shows which.",
    exitCode: ExitCode.failure,
  },
  not_found: { exitCode: ExitCode.notFound },
  conflict: { exitCode: ExitCode.failure },
  rate_limited: { hint: "Wait a moment, then try again.", exitCode: ExitCode.failure },
  unavailable: {
    hint: "This Voidhash server cannot do this right now. Try again later.",
    exitCode: ExitCode.failure,
    isUnexpected: true,
  },
  internal: {
    hint: "This is a problem on our side. If it keeps happening, contact support with the request id.",
    exitCode: ExitCode.failure,
    isUnexpected: true,
  },
};

/** The exit code an HTTP status without an error envelope ends in. */
export const exitCodeForStatus = (status: number): ExitCode => {
  if (status === 400) return ExitCode.usage;
  if (status === 401) return ExitCode.unauthenticated;
  if (status === 404) return ExitCode.notFound;
  return ExitCode.failure;
};

/** The `Request id: …` line for `response`, when it carries one. */
const requestIdLines = (response: HttpClientResponse.HttpClientResponse) =>
  Arr.fromOption(
    Option.map(
      Option.fromNullishOr(response.headers["request-id"]),
      (requestId) => `Request id: ${requestId}`,
    ),
  );

/** The failure for an answer without an error envelope, such as a proxy's error page. */
const statusError = (response: HttpClientResponse.HttpClientResponse) =>
  userError(`The Voidhash API answered HTTP ${response.status}.`, {
    hint: requestIdLines(response).join("\n"),
    exitCode: exitCodeForStatus(response.status),
  });

/** The failure for an error envelope the API answered with. */
const envelopeError = (
  { error: { code, message, param, type } }: typeof ApiErrorEnvelope.Type,
  response: HttpClientResponse.HttpClientResponse,
  hints: Readonly<Record<string, string>>,
) => {
  const known = ERROR_TYPES[type] ?? {
    exitCode: exitCodeForStatus(response.status),
    isUnexpected: true,
  };
  // A rule the request broke names its field, unless the message already does.
  const field =
    type === "invalid_request" && P.isString(param) && !message.includes(param)
      ? [`The problem is with ${param}.`]
      : [];
  return userError([message, ...field].join(" "), {
    hint: [
      ...Arr.fromOption(Option.fromNullishOr(hints[code] ?? known.hint)),
      ...(known.isUnexpected === true ? requestIdLines(response) : []),
    ].join("\n"),
    exitCode: known.exitCode,
  });
};

/**
 * What the person reads when the API refused a call or could not be reached:
 * the API's own message (written for people), the next step its error `type`
 * suggests, and the `Request-Id` when the failure is unexpected. Exits with the
 * code the `type` maps to (`unauthenticated` 3, `not_found` 4,
 * `invalid_request` 2, the rest 1).
 *
 * `hints` replaces the next step for specific error `code`s when the command
 * knows a better one:
 *
 * ```ts
 * api.productsDelete(projectId, product.id).pipe(
 *   Effect.mapError((error) =>
 *     apiError(error, { product_in_use: "Remove its store products first: 'voidhash-cli open product pro'." }),
 *   ),
 * )
 * ```
 *
 * A command that adds nothing need not map its API failures at all: the CLI
 * renders every failure a command leaves unhandled with this function.
 */
export const apiError = (
  error: ApiFailure,
  hints: Readonly<Record<string, string>> = {},
): CliError.UserError =>
  HttpClientError.isHttpClientError(error)
    ? Match.valueTags(error.reason, {
        // The generated client puts the body of a status it does not declare in the description.
        StatusCodeError: (reason) =>
          Option.match(decodeEnvelopeJson(reason.description ?? ""), {
            onNone: () => statusError(reason.response),
            onSome: (envelope) => envelopeError(envelope, reason.response, hints),
          }),
        DecodeError: (reason) =>
          userError("The Voidhash API sent an answer the CLI could not read.", {
            hint: requestIdLines(reason.response).join("\n"),
          }),
        EmptyBodyError: (reason) =>
          userError("The Voidhash API sent an empty answer.", {
            hint: requestIdLines(reason.response).join("\n"),
          }),
        TransportError: () => unreachable(error),
        EncodeError: () => unreachable(error),
        InvalidUrlError: () => unreachable(error),
      })
    : Option.match(decodeEnvelope(error.data), {
        onNone: () => statusError(error.response),
        onSome: (envelope) => envelopeError(envelope, error.response, hints),
      });

const unreachable = (error: HttpClientError.HttpClientError) =>
  userError(`Could not reach the Voidhash API (${error.request.url}).`, {
    hint: "Check your connection, or the api_url 'voidhash-cli config' shows.",
  });

const isShowHelp = Schema.is(CliError.ShowHelp);

/**
 * The exit code a command that failed with `error` ends in: the one its
 * {@link userError} carries, 2 for a command line the parser rejected, 0 for
 * a help request.
 */
export const exitCodeOf = (error: unknown): number => {
  if (isShowHelp(error)) return Arr.isReadonlyArrayEmpty(error.errors) ? 0 : ExitCode.usage;
  if (Schema.is(CliError.UserError)(error)) {
    return Schema.is(UserMessageError)(error.cause)
      ? (error.cause.exitCode ?? ExitCode.failure)
      : ExitCode.failure;
  }
  return CliError.isCliError(error) ? ExitCode.usage : Runtime.getErrorExitCode(error);
};

/** Ends the process with {@link exitCodeOf} the failure, 130 when interrupted, 0 otherwise. */
export const exitCodeTeardown: Runtime.Teardown = (exit, onExit) =>
  Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
    ? onExit(exitCodeOf(Cause.squash(exit.cause)))
    : Runtime.defaultTeardown(exit, onExit);

/**
 * Wraps the whole CLI. `Command.run` renders the failures it knows (a
 * {@link userError}, a rejected command line); this renders the rest the way
 * it renders a {@link userError}: a failed API call with {@link apiError},
 * anything else as a short message that points at `--debug`. With `--debug`
 * it prints the full cause first.
 */
export const reportFailures = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | CliError.UserError, R> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Effect.gen(function* () {
        const error = Cause.squash(cause);
        if (isDebugMode() && !Cause.hasInterruptsOnly(cause) && !isShowHelp(error)) {
          yield* Console.error(
            `\n--- Debug Trace ---\n${Cause.pretty(cause)}\n--- End Debug Trace ---\n`,
          );
        }
        if (Cause.hasInterruptsOnly(cause) || CliError.isCliError(error)) {
          return yield* Effect.failCause(cause);
        }
        const shown = isApiFailure(error)
          ? apiError(error)
          : userError(`Something went wrong: ${P.isError(error) ? error.message : String(error)}`, {
              hint: "Run the command again with --debug to see the details.",
            });
        yield* Console.error((yield* CliOutput.Formatter).formatError(shown));
        // Rendered above; the runtime must not log it a second time.
        shown[Runtime.errorReported] = false;
        return yield* Effect.fail(shown);
      }),
    ),
  );
