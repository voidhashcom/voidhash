import { ComponentDefinition } from "@voidhash/component-definition";
import type { DevSessionComponentJsonEncoding } from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { CliError } from "effect/cli";
import { HttpClientError } from "effect/http";

import type { ApiClientShape } from "../api-client";
import { componentApiUserError } from "../components/component-api";
import { userError } from "../error-formatter";
import type { DevStatus } from "./dev-server";

/**
 * The dev session of a `voidhash-cli dev` run: registered with Voidhash once
 * the local server listens, refreshed while it runs and ended when it stops,
 * so the paywall editor of the same person finds the server
 * (`docs/specs/component-dev-session.md`, "The dev session").
 */

/** The dev session calls a run makes. */
export type DevSessionApi = Pick<
  ApiClientShape,
  | "componentDevSessionsCreate"
  | "componentDevSessionsUpdate"
  | "componentDevSessionsDelete"
  | "componentDevSessionsList"
>;

/** How often a run reports while nothing changes; a session expires 30 s after its last report. */
export const HEARTBEAT_INTERVAL = Duration.seconds(10);

/** How long after a change a run reports it. */
const CHANGE_REPORT_DELAY = Duration.millis(500);

/** How long ending the session may hold up the end of a run. */
const END_TIMEOUT = Duration.seconds(2);

/** A component as a session reports it: its status entry, with its definition. */
export type ReportedComponent = DevSessionComponentJsonEncoding & {
  /** The encoded definition of the last successful build. */
  readonly definition?: unknown;
};

const encodeDefinition = Schema.encodeSync(ComponentDefinition);

/**
 * The components of a session: each status entry without the build log, the
 * panel manifest and the URLs.
 */
export const reportedComponents = (status: DevStatus): Array<ReportedComponent> =>
  status.components.map((component) => ({
    slug: component.slug,
    definitionId: component.definitionId,
    title: component.title,
    origin: component.origin,
    ...(component.baseVersion === undefined ? {} : { baseVersion: component.baseVersion }),
    ...(component.publishedVersion === undefined
      ? {}
      : { publishedVersion: component.publishedVersion }),
    isModified: component.isModified,
    isConflicted: component.isConflicted,
    build: {
      state: component.build.state,
      ...(component.build.message === null ? {} : { message: component.build.message }),
    },
    ...(component.component === null
      ? {}
      : {
          moduleHash: component.component.module.hash,
          ...(component.component.panel === null
            ? {}
            : { panelHash: component.component.panel.hash }),
          definition: encodeDefinition(component.component.definition),
        }),
  }));

/** Every failure a dev session call can report. */
type DevSessionCallError = Parameters<typeof componentApiUserError>[0];

/** The HTTP status of a failed call; none when the request never got an answer. */
const statusOf = (error: DevSessionCallError) =>
  HttpClientError.isHttpClientError(error)
    ? Option.fromNullishOr(error.response?.status)
    : Option.some(error.response.status);

/**
 * What a failed report means: the session no longer exists (`gone`, only for
 * a refresh), the run cannot report at all (`fatal`: signed out, or not
 * allowed to), or Voidhash cannot be reached right now (`transient`).
 */
export const reportFailureKind = (
  call: "register" | "update",
  status: Option.Option<number>,
): "gone" | "fatal" | "transient" => {
  if (Option.isNone(status)) return "transient";
  if (call === "update" && status.value === 404) return "gone";
  if (status.value === 401 || status.value === 403) return "fatal";
  if (call === "register" && status.value === 404) return "fatal";
  return "transient";
};

/**
 * What a run whose session is gone does: stop when another session of the
 * user in the project is active (another run took over), or register again
 * (the session expired, for example while the computer slept).
 */
export const afterSessionGone = (
  activeSessions: ReadonlyArray<{ readonly id: string }>,
  ownSessionId: string,
): "taken-over" | "register" =>
  activeSessions.some((session) => session.id !== ownSessionId) ? "taken-over" : "register";

/** The message a run stops with when another run took its session. */
export const TAKEN_OVER_MESSAGE =
  "Another voidhash-cli dev took over this project, so this one stopped. Only one run per project reaches the paywall editor.";

/**
 * A run's reports to its session. `report` registers the session, or
 * refreshes it with the current components, and fails only when the run
 * must stop; Voidhash being out of reach prints a warning once and the next
 * report tries again. `end` ends the session, if there is one.
 */
export const makeDevSessionReporter = Effect.fn("makeDevSessionReporter")(function* (options: {
  readonly api: DevSessionApi;
  readonly projectId: string;
  /** The server's origin, `http://127.0.0.1:<port>`. */
  readonly url: string;
  readonly token: string;
  readonly components: Effect.Effect<ReadonlyArray<ReportedComponent>>;
}) {
  const { api, projectId } = options;
  const sessionId = yield* Ref.make(Option.none<string>());
  const warning = yield* Ref.make(Option.none<string>());

  const warnOnce = (message: string) =>
    Effect.gen(function* () {
      if (Option.contains(yield* Ref.get(warning), message)) return;
      yield* Ref.set(warning, Option.some(message));
      yield* Console.error(
        `! Could not reach Voidhash to report the dev session (${message}); retrying. The local server keeps running.`,
      );
    });

  /** Notes the end of an outage that a warning reported. */
  const reached = Effect.fn("DevSessionReporter.reached")(function* () {
    if (Option.isNone(yield* Ref.getAndSet(warning, Option.none()))) return;
    yield* Console.log("✓ Reaching Voidhash again; the dev session is up to date.");
  })();

  const failed = (call: "register" | "update", error: DevSessionCallError) =>
    reportFailureKind(call, statusOf(error)) === "fatal"
      ? Effect.fail(componentApiUserError(error))
      : warnOnce(componentApiUserError(error).message);

  const register = Effect.gen(function* () {
    const session = yield* api.componentDevSessionsCreate(projectId, {
      url: options.url,
      token: options.token,
      components: yield* options.components,
    });
    yield* Ref.set(sessionId, Option.some(session.id));
    yield* Console.log(
      "✓ Registered the dev session: your paywall editor picks these builds up on its own.",
    );
  }).pipe(
    Effect.andThen(reached),
    Effect.catch((error) => failed("register", error)),
  );

  const whenGone = (ownSessionId: string) =>
    Effect.gen(function* () {
      // A person has at most one session per project, so the first page holds it.
      const listed = yield* Effect.result(api.componentDevSessionsList(projectId));
      if (Result.isFailure(listed)) return yield* failed("update", listed.failure);
      yield* Ref.set(sessionId, Option.none());
      if (afterSessionGone(listed.success.data, ownSessionId) === "taken-over") {
        return yield* Effect.fail(userError(TAKEN_OVER_MESSAGE));
      }
      yield* register;
    });

  const update = (id: string) =>
    Effect.gen(function* () {
      yield* api.componentDevSessionsUpdate(projectId, id, {
        components: yield* options.components,
      });
      yield* reached;
    }).pipe(
      Effect.catch((error) =>
        reportFailureKind("update", statusOf(error)) === "gone"
          ? whenGone(id)
          : failed("update", error),
      ),
    );

  const report: Effect.Effect<void, CliError.UserError> = Effect.flatMap(
    Ref.get(sessionId),
    Option.match({ onNone: () => register, onSome: update }),
  );

  const end = Effect.flatMap(
    Ref.get(sessionId),
    Option.match({
      onNone: () => Effect.void,
      onSome: (id) =>
        api.componentDevSessionsDelete(projectId, id).pipe(
          Effect.mapError((error) => componentApiUserError(error).message),
          Effect.timeoutOption(END_TIMEOUT),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail("Voidhash did not answer in time"),
              onSome: () => Effect.void,
            }),
          ),
          Effect.catch((reason) =>
            Console.error(
              `! Could not end the dev session (${reason}); it expires on its own within 30 seconds.`,
            ),
          ),
        ),
    }),
  );

  return { report, end };
});

/**
 * Reports the session while the run lasts: once now, every
 * {@link HEARTBEAT_INTERVAL}, and shortly after each of `changes`; ends the
 * session when the scope closes. Fails only when the run must stop.
 */
export const runDevSessionReports = Effect.fn("runDevSessionReports")(function* (
  reporter: Effect.Success<ReturnType<typeof makeDevSessionReporter>>,
  changes: Stream.Stream<unknown>,
) {
  yield* Effect.addFinalizer(() => reporter.end);
  yield* reporter.report;
  return yield* Stream.merge(
    Stream.tick(HEARTBEAT_INTERVAL).pipe(Stream.drop(1)),
    changes.pipe(Stream.debounce(CHANGE_REPORT_DELAY)),
  ).pipe(
    Stream.runForEach(() => reporter.report),
    Effect.andThen(Effect.never),
  );
});
