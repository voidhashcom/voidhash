import type { SessionJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import { HttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
// oxlint-disable-next-line effect/use-temp-file-scoped -- reads the computer's name and operating system for the sign-in request; no temporary files are involved.
import { hostname, platform } from "node:os";

import { ApiClient } from "../../utils/api-client";
import { openInBrowser } from "../../utils/browser";
import { printable } from "../../utils/printable";
import {
  DeviceLoginError,
  FailedToGetSessionError,
  FailedToLoginError,
  FailedToLogoutError,
  FailedToStoreCredentialError,
  NoSignedInUserError,
} from "../errors/auth";
import { CliConfig } from "./cli-config";
import { apiOrigin, Credentials, describeCredentialSource } from "./credentials";
import {
  type AdvertisedDashboard,
  advertisedDashboard,
  isPlainHttpOnDashboard,
  openableVerificationUrl,
  PLAIN_ORIGIN,
  pollForToken,
  printableUrl,
  requestDeviceAuthorization,
  requestDeviceToken,
  Revocation,
  revokeToken,
  shouldOpenBrowser,
  unrevokedNote,
} from "./device-login";

/** How `voidhash login` signs in. */
export interface LoginOptions {
  /** Ask for a read-only session (`scope=read`). */
  readonly readOnly: boolean;
  /** Print the address without trying to open a browser. */
  readonly noBrowser: boolean;
}

interface AuthShape {
  readonly getSignedInSession: Effect.Effect<
    SessionJsonEncoding,
    FailedToGetSessionError | NoSignedInUserError
  >;
  readonly login: (
    options: LoginOptions,
  ) => Effect.Effect<void, FailedToLoginError | DeviceLoginError>;
  readonly logout: Effect.Effect<void, FailedToLogoutError>;
}

const hasTag = (error: unknown, tag: string): error is { readonly _tag: string } =>
  P.isObject(error) &&
  error !== null &&
  "_tag" in error &&
  P.isString(error._tag) &&
  error._tag === tag;

/**
 * Who a session acts as, for messages: the person signed in, or the project
 * secret key when the stored key is one.
 */
export const sessionHolder = (session: SessionJsonEncoding): string =>
  session.person === null ? "a project secret key" : session.person.name;

const isNoSignedInUserError = (error: unknown): error is NoSignedInUserError =>
  error instanceof NoSignedInUserError || hasTag(error, "NoSignedInUserError");

/** The message of a failure's cause, for a short report of why signing in or out failed. */
const causeMessage = (cause: unknown, fallback: string) =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback;

const optionalVariable = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Effect.map(Option.filter((value) => value !== "")),
    Effect.orElseSucceed(() => Option.none<string>()),
  );

const make = Effect.fn("make")(function* effect() {
  const client = yield* ApiClient;
  const cliConfig = yield* CliConfig;
  const credentials = yield* Credentials;
  const httpClient = yield* HttpClient.HttpClient;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const readConfig = cliConfig
    .readConfig()
    .pipe(Effect.catch(() => Effect.die("Failed to read config")));

  /**
   * Retrieves the session the CLI's credential for the API host describes.
   *
   * Fails with a `NoSignedInUserError` when there is no credential for the
   * host, or the API no longer accepts it (it expired, or the CLI was
   * disconnected), and with a `FailedToGetSessionError` otherwise.
   *
   * @returns An Effect that yields the session: the person it acts for and
   *   the organizations and projects it can use.
   */
  const getSignedInSession: AuthShape["getSignedInSession"] = Effect.fn("getSignedInSession")(
    function* getSignedInSession() {
      const config = yield* readConfig;
      const credential = yield* credentials.resolve(config.api_url);
      if (Option.isNone(credential)) {
        yield* Effect.logDebug("No credential found for the API host");
        return yield* Effect.fail(new NoSignedInUserError({ message: "No signed in user" }));
      }

      yield* Effect.logDebug("Fetching session from API");
      return yield* client.sessionGet().pipe(
        Effect.tap((session) =>
          Effect.logDebug(`Session retrieved for: ${sessionHolder(session)} (${session.kind})`),
        ),
        Effect.catchTag("UnauthenticatedErrorJsonEncoding", () =>
          Effect.fail(new NoSignedInUserError({ message: "No signed in user" })),
        ),
      );
    },
  )().pipe(
    Effect.withSpan("Auth.getSignedInSession"),
    Effect.catchIf(
      isNoSignedInUserError,
      (error) => Effect.fail(error),
      (error) =>
        Effect.fail(
          new FailedToGetSessionError({
            cause: error,
            message: "Failed to get session",
          }),
        ),
    ),
  );

  /**
   * Signs in with the device authorization grant: the person approves a code
   * in the browser while the CLI polls for the token, which it then stores for
   * the API origin.
   */
  const login: AuthShape["login"] = (options) =>
    Effect.gen(function* login() {
      const config = yield* readConfig;
      const authorization = yield* requestDeviceAuthorization(config.api_url, {
        readOnly: options.readOnly,
        deviceName: hostname(),
        installId: yield* cliConfig.installId(),
      });

      yield* Console.log(
        [
          `To sign in, open ${printableUrl(authorization.verification_uri)} and enter`,
          "",
          `    ${printable(authorization.user_code)}`,
          "",
        ].join("\n"),
      );
      const openBrowser = shouldOpenBrowser({
        noBrowser: options.noBrowser,
        platform: platform(),
        env: {
          sshConnection: yield* optionalVariable("SSH_CONNECTION"),
          sshTty: yield* optionalVariable("SSH_TTY"),
          display: yield* optionalVariable("DISPLAY"),
          waylandDisplay: yield* optionalVariable("WAYLAND_DISPLAY"),
        },
      });
      const verificationUri =
        authorization.verification_uri_complete ?? authorization.verification_uri;
      const configured = openableVerificationUrl(verificationUri, config.web_url);
      const advertised =
        openBrowser && Option.isNone(configured)
          ? yield* advertisedDashboard(config.api_url)
          : Option.none<AdvertisedDashboard>();
      const browserUrl = openBrowser
        ? Option.orElse(configured, () =>
            Option.flatMap(
              Option.filter(advertised, ({ isTrusted }) => isTrusted),
              ({ origin }) => openableVerificationUrl(verificationUri, origin),
            ),
          )
        : Option.none<string>();
      if (openBrowser && Option.isNone(browserUrl)) {
        const profile =
          cliConfig.activeProfile === "" ? "" : ` --profile ${cliConfig.activeProfile}`;
        // A dashboard the server names off its own domain is only suggested,
        // when the address is one of its pages.
        const suggested = Option.filter(
          advertised,
          ({ isTrusted, origin }) =>
            !isTrusted &&
            Option.isSome(openableVerificationUrl(verificationUri, origin)) &&
            // Meant to be pasted, and a URL's host may hold what a shell would run.
            PLAIN_ORIGIN.test(origin),
        );
        yield* Console.error(
          Option.match(suggested, {
            onNone: () =>
              isPlainHttpOnDashboard(verificationUri, config.web_url) ||
              Option.exists(advertised, ({ origin }) =>
                isPlainHttpOnDashboard(verificationUri, origin),
              )
                ? `! The browser was not opened: ${printableUrl(verificationUri)} is plain HTTP to another computer, which the CLI does not open. Open it yourself if you trust this network.`
                : `! The browser was not opened: ${printableUrl(verificationUri)} is not on ${config.web_url}, the dashboard the CLI is set up for, or on one the server names on its own domain. If you expected this address, open it yourself; 'voidhash-cli config set web_url <url>${profile}' sets the dashboard's address.`,
            onSome: ({ origin }) =>
              `! The browser was not opened: ${printableUrl(verificationUri)} is not on ${config.web_url}, the dashboard the CLI is set up for. The server names ${origin} as its dashboard, which is not on the domain of ${config.api_url}, so the CLI does not open it. If that is your dashboard, run 'voidhash-cli config set web_url ${origin}${profile}'; otherwise open the address yourself.`,
          }),
        );
      }
      if (openBrowser && Option.isSome(browserUrl)) {
        yield* Console.log("Opening your browser… (press Ctrl+C to cancel)");
        yield* openInBrowser(browserUrl.value).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        );
      } else {
        yield* Console.log("Waiting for you to approve… (press Ctrl+C to cancel)");
      }

      const token = yield* pollForToken(
        requestDeviceToken(config.api_url, authorization.device_code),
        { interval: authorization.interval ?? 5, expiresIn: authorization.expires_in },
      ).pipe(Effect.onInterrupt(() => Console.log("\nSign-in cancelled.")));

      const previous = yield* credentials
        .stored(config.api_url)
        .pipe(Effect.orElseSucceed(() => Option.none()));
      const credential = yield* credentials.save(config.api_url, token.accessToken).pipe(
        // The server has started a session for the token, which nothing here
        // could use or end once the token is lost.
        Effect.catch((cause) =>
          revokeToken(config.api_url, token.accessToken).pipe(
            Effect.flatMap((revocation) =>
              Effect.fail(
                new FailedToStoreCredentialError({
                  cause,
                  message: [
                    `Could not save the token: ${cause.message}.`,
                    Option.getOrElse(
                      unrevokedNote(revocation),
                      () => "The session it started has ended on the server.",
                    ),
                  ].join("\n"),
                }),
              ),
            ),
          ),
        ),
      );
      // The server replaces this installation's earlier session itself; a key
      // from before installation ids is revoked here, which may fail and leave
      // its session active. A project key is only replaced, and that may have
      // been the only copy of it.
      const replaced =
        Option.isSome(previous) && previous.value.token !== token.accessToken
          ? Option.some(yield* revokeToken(config.api_url, previous.value.token))
          : Option.none<Revocation>();
      const replacedNote = Option.flatMap(replaced, (revocation) =>
        // The new sign-in may be this computer's session itself, which disconnecting would end.
        Option.map(
          unrevokedNote(
            revocation,
            "if an older sign-in from this computer is still listed under Settings → Devices and apps in the dashboard, disconnect it there.",
          ),
          (note) =>
            Revocation.$is("NotASession")(revocation)
              ? `The project key stored for ${credential.origin} was replaced, so the CLI no longer has it. ${note}`
              : `The earlier sign-in stored for ${credential.origin} was replaced. ${note}`,
        ),
      );

      if (Option.isSome(credentials.environmentKey)) {
        yield* Console.log(
          [
            `✓ Signed in on ${credential.origin}.`,
            "VOIDHASH_API_KEY is set, so commands keep using it until you unset it.",
          ].join("\n"),
        );
      } else {
        const session = yield* client
          .sessionGet()
          .pipe(Effect.timeout("15 seconds"), Effect.option);
        const who = Option.match(session, {
          onNone: () => "",
          onSome: ({ person }) =>
            person === null ? "" : ` as ${printable(person.name)} (${printable(person.email)})`,
        });
        const readOnly = Option.exists(session, ({ isReadOnly }) => isReadOnly);
        yield* Console.log(
          `✓ Signed in${who} on ${credential.origin}${readOnly ? ", read-only" : ""}`,
        );
      }
      if (Option.isSome(replacedNote)) yield* Console.error(replacedNote.value);
      if (credential.source === "file") {
        const stored = `the token is stored in ${credentials.filePath}, readable only by you.`;
        yield* Console.error(
          Option.match(credentials.osStore, {
            onNone: () => `No system keychain is available, so ${stored}`,
            onSome: (kind) =>
              `Could not write to ${describeCredentialSource(kind, credentials.filePath)} (run with --debug to see why), so ${stored}`,
          }),
        );
      }
    }).pipe(
      Effect.provideService(HttpClient.HttpClient, httpClient),
      Effect.withSpan("Auth.login"),
      Effect.catchIf(
        (error) => !(error instanceof DeviceLoginError),
        (cause) =>
          Effect.fail(
            new FailedToLoginError({ cause, message: causeMessage(cause, "Failed to login") }),
          ),
      ),
    );

  /**
   * Signs out on the API origin: revokes the stored token on the server when
   * it can be reached, and deletes it here even when it cannot. Fails, saying
   * what did happen, when the token could not be read or deleted.
   */
  const logout: AuthShape["logout"] = Effect.fn("logout")(function* logout() {
    const config = yield* readConfig;
    const stored = yield* credentials
      .stored(config.api_url)
      .pipe(
        Effect.mapError(
          (cause) =>
            new FailedToLogoutError({ cause, message: `${cause.message}. Nothing was changed.` }),
        ),
      );
    const environmentNote = Option.isSome(credentials.environmentKey)
      ? ["VOIDHASH_API_KEY is set in the environment; unset it to stop using that key."]
      : [];
    if (Option.isNone(stored)) {
      const origin = Option.getOrElse(apiOrigin(config.api_url), () => config.api_url);
      yield* Console.log([`You are not signed in on ${origin}.`, ...environmentNote].join("\n"));
      return;
    }

    const { origin, token, source } = stored.value;
    const where = describeCredentialSource(source, credentials.filePath);
    const revocation = yield* revokeToken(config.api_url, token);
    const sessionNote = Arr.fromOption(unrevokedNote(revocation));
    yield* credentials.forget(stored.value).pipe(
      Effect.mapError(
        (cause) =>
          new FailedToLogoutError({
            cause,
            message: [
              `${cause.message}, so the token for ${origin} is still in ${where}.`,
              ...(Revocation.$is("Revoked")(revocation)
                ? ["Its session on the server has ended."]
                : sessionNote),
            ].join("\n"),
          }),
      ),
    );
    yield* Console.log(
      [
        `Signed out of ${origin}, and removed the token from ${where}.`,
        ...sessionNote,
        ...environmentNote,
      ].join("\n"),
    );
  })().pipe(
    Effect.provideService(HttpClient.HttpClient, httpClient),
    Effect.withSpan("Auth.logout"),
    Effect.catch((cause) =>
      Effect.fail(
        new FailedToLogoutError({ cause, message: causeMessage(cause, "Failed to logout") }),
      ),
    ),
  );

  return {
    getSignedInSession,
    login,
    logout,
  } satisfies AuthShape;
})();

/**
 * Needs the {@link ApiClient}, {@link CliConfig}, {@link Credentials}, an
 * `HttpClient` and a `ChildProcessSpawner`, which opens the browser.
 */
export class Auth extends Context.Service<Auth, AuthShape>()("voidhash-cli/Auth") {
  static Default = Layer.effect(Auth, make);
}
