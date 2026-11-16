import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient, Headers, HttpClient, HttpClientRequest } from "effect/http";

import { printable } from "../../utils/printable";
import { DeviceLoginError } from "../errors/auth";

/** The OAuth client the CLI signs in as. */
export const CLI_CLIENT_ID = "voidhash-cli";

/**
 * An address from the server, as printed: the URL's own serialization, which
 * escapes anything a terminal could act on, or {@link printable} text when it
 * is not a URL.
 */
export const printableUrl = (uri: string) =>
  Option.match(Option.liftThrowable(() => new URL(uri))(), {
    onNone: () => printable(uri),
    onSome: ({ href }) => href,
  });

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

/** The answer to `POST /oauth/device_authorization` (RFC 8628 §3.2). */
export const DeviceAuthorization = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.optional(Schema.String),
  expires_in: Schema.Number,
  interval: Schema.optional(Schema.Number),
});
export type DeviceAuthorization = typeof DeviceAuthorization.Type;

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  scope: Schema.optional(Schema.String),
});

const OAuthErrorResponse = Schema.Struct({
  error: Schema.String,
  error_description: Schema.optional(Schema.String),
});

/** One answer of the token endpoint while the CLI waits for the person. */
export type TokenPollAnswer =
  | {
      readonly _tag: "approved";
      readonly accessToken: string;
      readonly scope: Option.Option<string>;
    }
  | { readonly _tag: "error"; readonly error: string; readonly description: Option.Option<string> };

/** A poll that did not reach the server or got no usable answer; the CLI retries it. */
export class TransientPollError extends Schema.TaggedError<TransientPollError>(
  "TransientPollError",
)("TransientPollError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

/** The longest the CLI waits between polls after network failures. */
const MAX_BACKOFF_SECONDS = 60;

/** The longest the CLI waits for the answer to one poll. */
const POLL_TIMEOUT_MILLIS = 30_000;

type Approved = Extract<TokenPollAnswer, { readonly _tag: "approved" }>;

/**
 * Polls the token endpoint until the person approves or denies the sign-in, or
 * the code expires (RFC 8628 §3.4–3.5). It waits `interval` seconds before each
 * poll, five more after every `slow_down`, and backs off exponentially while
 * polls fail to reach the server. A poll the server does not answer within 30
 * seconds, or before the code expires, counts as one that failed.
 */
export const pollForToken = Effect.fn("pollForToken")(function* <R>(
  poll: Effect.Effect<TokenPollAnswer, TransientPollError, R>,
  options: { readonly interval: number; readonly expiresIn: number },
) {
  const deadline = (yield* Clock.currentTimeMillis) + options.expiresIn * 1000;
  const expired = new DeviceLoginError({
    reason: "expired",
    message: "The sign-in code expired before it was approved.",
  });

  const step = Effect.fnUntraced(function* (
    interval: number,
    failures: number,
  ): Effect.fn.Return<Approved, DeviceLoginError, R> {
    const wait = Math.min(interval * 2 ** failures, Math.max(interval, MAX_BACKOFF_SECONDS));
    yield* Effect.sleep(`${wait} seconds`);
    const now = yield* Clock.currentTimeMillis;
    if (now >= deadline) return yield* expired;

    const answer = yield* poll.pipe(
      Effect.timeoutOrElse({
        duration: Math.min(POLL_TIMEOUT_MILLIS, deadline - now),
        orElse: () =>
          Effect.fail(new TransientPollError({ message: "The server did not answer in time." })),
      }),
      Effect.result,
    );
    if (Result.isFailure(answer)) {
      yield* Effect.logDebug(`Polling for the token failed, retrying: ${answer.failure.message}`);
      return yield* step(interval, failures + 1);
    }
    return yield* Match.value(answer.success).pipe(
      Match.tag("approved", (approved) => Effect.succeed(approved)),
      Match.tag("error", ({ error, description }) =>
        Match.value(error).pipe(
          Match.when("authorization_pending", () => step(interval, 0)),
          Match.when("slow_down", () => step(interval + 5, 0)),
          Match.when("access_denied", () =>
            Effect.fail(
              new DeviceLoginError({
                reason: "denied",
                message: "The sign-in was denied in the browser.",
              }),
            ),
          ),
          Match.when("expired_token", () => Effect.fail(expired)),
          Match.when("invalid_grant", () =>
            Effect.fail(
              new DeviceLoginError({
                reason: "invalid_grant",
                message: "The sign-in code is no longer valid.",
              }),
            ),
          ),
          Match.orElse(() =>
            Effect.fail(
              new DeviceLoginError({
                reason: "rejected",
                message: `The server refused the sign-in: ${printable(Option.getOrElse(description, () => error))}`,
              }),
            ),
          ),
        ),
      ),
      Match.exhaustive,
    );
  });

  return yield* step(Math.max(options.interval, 1), 0);
});

/**
 * Posts `fields` as a form to `url` and reads the JSON answer with its status
 * and headers. Fails with a `TimeoutError` when the server has not answered
 * within 20 seconds, so a server that accepts the connection and never answers
 * cannot hang the CLI.
 */
const postForm = (url: string, fields: Record<string, string>) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post(url).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyUrlParams(fields),
      ),
    );
    const body = yield* response.json.pipe(Effect.orElseSucceed((): unknown => null));
    return { status: response.status, headers: response.headers, body };
  }).pipe(Effect.timeout("20 seconds"));

/** Why a request did not get an answer, for messages. */
const unanswered = (apiUrl: string, cause: unknown) =>
  Cause.isTimeoutError(cause) ? `${apiUrl} did not answer in time.` : `Could not reach ${apiUrl}.`;

/**
 * How long a `Retry-After` header (RFC 9110 §10.2.3) asks to wait, in seconds:
 * it holds either the seconds or the date to wait until.
 */
const retryAfterSeconds = (value: Option.Option<string>, now: number): Option.Option<number> =>
  Option.flatMap(
    Option.filter(Option.map(value, Str.trim), Str.isNonEmpty),
    (trimmed): Option.Option<number> =>
      /^\d+$/.test(trimmed)
        ? Option.some(Number(trimmed))
        : Option.map(DateTime.make(trimmed), (until) =>
            Math.max(0, Math.ceil((DateTime.toEpochMillis(until) - now) / 1000)),
          ),
  );

/** A wait for messages: "45 seconds", "4 minutes". */
const formatWait = (seconds: number) => {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
};

/**
 * Asks the server for a device code (`POST {api}/oauth/device_authorization`).
 * `readOnly` asks for `scope=read`; `deviceName` and `installId` are shown to
 * the person and keep one session per installation.
 */
export const requestDeviceAuthorization = Effect.fn("requestDeviceAuthorization")(function* (
  apiUrl: string,
  options: { readonly readOnly: boolean; readonly deviceName: string; readonly installId: string },
) {
  const { status, headers, body } = yield* postForm(
    new URL("/oauth/device_authorization", apiUrl).toString(),
    {
      client_id: CLI_CLIENT_ID,
      scope: options.readOnly ? "read" : "read write",
      install_id: options.installId,
      ...(options.deviceName === "" ? {} : { device_name: options.deviceName }),
    },
  ).pipe(
    Effect.mapError(
      (cause) => new TransientPollError({ cause, message: unanswered(apiUrl, cause) }),
    ),
  );
  if (status === 200) {
    return yield* Schema.decodeUnknownEffect(DeviceAuthorization)(body).pipe(
      Effect.mapError(
        (cause) =>
          new TransientPollError({ cause, message: "The server's answer could not be read." }),
      ),
    );
  }
  const error = Schema.decodeUnknownOption(OAuthErrorResponse)(body);
  if (status === 429 || Option.exists(error, ({ error }) => error === "slow_down")) {
    // The server limits sign-ins per network over a 10-minute window.
    const wait = retryAfterSeconds(
      Headers.get(headers, "retry-after"),
      yield* Clock.currentTimeMillis,
    );
    return yield* new DeviceLoginError({
      reason: "rejected",
      message: `Too many sign-in attempts from this network. ${Option.match(wait, {
        onNone: () => "Wait up to 10 minutes and try again.",
        onSome: (seconds) => `Try again in ${formatWait(Math.max(seconds, 1))}.`,
      })}`,
    });
  }
  return yield* new DeviceLoginError({
    reason: "rejected",
    message: Option.match(error, {
      onNone: () => `The server refused to start a sign-in (status ${status}).`,
      onSome: ({ error, error_description }) =>
        `The server refused to start a sign-in: ${printable(error_description ?? error)}.`,
    }),
  });
});

/**
 * One poll of the token endpoint with the device code. A failure to reach the
 * server, no answer in time, a server error or an unreadable answer is a
 * {@link TransientPollError}.
 */
export const requestDeviceToken = (
  apiUrl: string,
  deviceCode: string,
): Effect.Effect<TokenPollAnswer, TransientPollError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const { status, body } = yield* postForm(new URL("/oauth/token", apiUrl).toString(), {
      grant_type: DEVICE_CODE_GRANT,
      device_code: deviceCode,
      client_id: CLI_CLIENT_ID,
    }).pipe(
      Effect.mapError(
        (cause) => new TransientPollError({ cause, message: unanswered(apiUrl, cause) }),
      ),
    );
    if (status === 200) {
      const token = Schema.decodeUnknownOption(TokenResponse)(body);
      if (Option.isSome(token)) {
        return {
          _tag: "approved",
          accessToken: token.value.access_token,
          scope: Option.fromNullishOr(token.value.scope),
        } satisfies TokenPollAnswer;
      }
    }
    const error =
      status >= 400 && status < 500
        ? Schema.decodeUnknownOption(OAuthErrorResponse)(body)
        : Option.none();
    if (Option.isSome(error)) {
      return {
        _tag: "error",
        error: error.value.error,
        description: Option.fromNullishOr(error.value.error_description),
      } satisfies TokenPollAnswer;
    }
    return yield* new TransientPollError({
      message: `Unexpected answer from the server (status ${status}).`,
    });
  });

/** What became of a revocation: the session ended, or why it may not have. */
export type Revocation = Data.TaggedEnum<{
  // oxlint-disable-next-line effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}.
  Revoked: {};
  /** The key is a project key, not a sign-in, so it was not sent. */
  // oxlint-disable-next-line effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}.
  NotASession: {};
  // oxlint-disable-next-line effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}.
  Unreachable: {};
  // oxlint-disable-next-line effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}.
  TimedOut: {};
  /** The server answered with an error. */
  Failed: { readonly status: number };
}>;
export const Revocation = Data.taggedEnum<Revocation>();

/**
 * Whether `token` is a sign-in that `/oauth/revoke` ends. As on the server,
 * that is every key but a project key (`vh_sk_…`, `vh_pk_…`): a token from
 * `login` (`vh_oat_…`), a key an earlier version of the CLI signed in with
 * (`vh_cli_…`), or a personal key from before sessions, whose prefix may be
 * its own.
 */
export const isSessionToken = (token: string) => !/^vh_[sp]k_/.test(token);

/**
 * Ends the session of `token` on the server (`POST {api}/oauth/revoke`, RFC
 * 7009). Best-effort: it never fails, and answers whether the session ended.
 * A project key, such as a secret key set by hand, is never sent: revocation
 * cannot end it, and should never be able to.
 */
export const revokeToken = (
  apiUrl: string,
  token: string,
): Effect.Effect<Revocation, never, HttpClient.HttpClient> =>
  isSessionToken(token)
    ? postForm(new URL("/oauth/revoke", apiUrl).toString(), {
        token,
        client_id: CLI_CLIENT_ID,
      }).pipe(
        Effect.map(({ status }) =>
          status >= 200 && status < 300 ? Revocation.Revoked() : Revocation.Failed({ status }),
        ),
        Effect.catch((error) =>
          Effect.logDebug(`Revoking the token failed: ${String(error)}`).pipe(
            Effect.as(
              Cause.isTimeoutError(error) ? Revocation.TimedOut() : Revocation.Unreachable(),
            ),
          ),
        ),
      )
    : Effect.succeed(Revocation.NotASession());

/**
 * Why the session may still be active after {@link revokeToken}, and what to
 * do about it; none when it ended.
 */
export const unrevokedNote = (
  revocation: Revocation,
  disconnect = "disconnect the CLI under Settings → Devices and apps in the dashboard.",
): Option.Option<string> =>
  Revocation.$match(revocation, {
    Revoked: () => Option.none(),
    NotASession: () =>
      Option.some(
        "The key is not a sign-in, so it was not revoked and still works; delete it in the dashboard if nothing else uses it.",
      ),
    Unreachable: () =>
      Option.some(`The server could not be reached to end the session; ${disconnect}`),
    TimedOut: () =>
      Option.some(
        `The server did not answer in time, so the session may not have ended; ${disconnect}`,
      ),
    Failed: ({ status }) =>
      Option.some(`The server could not end the session (status ${status}); ${disconnect}`),
  });

/** Hosts plain HTTP may reach: this computer, as when a local server runs the dashboard. */
const LOOPBACK_HOSTS: ReadonlyArray<string> = ["localhost", "127.0.0.1", "[::1]"];

const isLoopback = (url: URL) => LOOPBACK_HOSTS.includes(url.hostname);

/** The URL's host without the dot that makes it fully qualified, which names the same host. */
const hostOf = (url: URL) => url.hostname.replace(/\.$/, "");

/** An origin safe to show inside a command to paste: nothing a shell would act on. */
export const PLAIN_ORIGIN = /^https?:\/\/[a-z0-9.:[\]-]+$/;

/** Whether `url` is HTTPS, or plain HTTP to this computer, which nobody on the way can answer for. */
const isSecure = (url: URL) =>
  url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url));

/**
 * The domain the dashboard of the API at `hostname` is on: the host without
 * its first label (`api.voidhash.com` → `voidhash.com`). None for an IP
 * address, or when that would leave a single label. Public suffixes such as
 * `co.uk` are not told apart: the dashboard comes from the API's own HTTPS
 * metadata, and that server can already send people to its own host, so all it
 * could gain is a sibling of its host.
 */
const parentDomain = (hostname: string): Option.Option<string> => {
  if (hostname.startsWith("[") || /^[\d.]+$/.test(hostname)) return Option.none();
  const [, ...rest] = hostname.split(".");
  return rest.length >= 2 ? Option.some(rest.join(".")) : Option.none();
};

/**
 * Whether the CLI may open pages of `dashboard` for the API at `api`: over
 * HTTPS, on the API's own host, its parent domain, or a subdomain of either, or
 * both on this computer.
 */
const isDashboardOf = (api: URL, dashboard: URL) => {
  if (isLoopback(api) && isLoopback(dashboard)) return isSecure(dashboard);
  const host = hostOf(dashboard);
  const isOn = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  return (
    dashboard.protocol === "https:" &&
    (isOn(hostOf(api)) || Option.exists(parentDomain(hostOf(api)), isOn))
  );
};

/**
 * Whether `uri` is on the dashboard `dashboardUrl` names, which the CLI would open but for it
 * being plain HTTP to another computer.
 */
export const isPlainHttpOnDashboard = (uri: string, dashboardUrl: string) =>
  Option.exists(Option.liftThrowable(() => new URL(uri))(), (url) =>
    Option.exists(
      Option.liftThrowable(() => new URL(dashboardUrl))(),
      ({ origin }) => origin === url.origin && url.protocol === "http:" && !isSecure(url),
    ),
  );

const AuthorizationServerMetadata = Schema.Struct({
  issuer: Schema.String,
  authorization_endpoint: Schema.String,
});

/** The dashboard a server names, and whether the CLI may open its pages. */
export interface AdvertisedDashboard {
  readonly origin: string;
  /** On the API's own domain (see {@link advertisedDashboard}); otherwise only suggested. */
  readonly isTrusted: boolean;
}

/**
 * The dashboard the server at `apiUrl` sends people to sign in at: the origin
 * of the `authorization_endpoint` in its metadata (RFC 8414). A profile that
 * sets only `api_url`, for staging or a server of your own, keeps the default
 * `web_url`, while this is the dashboard of the server it does name.
 *
 * The metadata is read only over HTTPS, or plain HTTP on this computer, without
 * following redirects, and only when its `issuer` is the API's origin, so no
 * one else can answer for the server. Even then the dashboard is trusted only
 * on the API's domain: HTTPS on the API's own host, its parent domain or a
 * subdomain of either (`api.voidhash.com` → `voidhash.com`, `app.voidhash.com`),
 * or this computer when the API is on it too. None when the metadata cannot be read in
 * time, or cannot be trusted.
 */
export const advertisedDashboard = (
  apiUrl: string,
): Effect.Effect<Option.Option<AdvertisedDashboard>, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const api = Option.getOrNull(
      Option.filter(Option.liftThrowable(() => new URL(apiUrl))(), isSecure),
    );
    if (api === null) return Option.none<AdvertisedDashboard>();
    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .execute(
        HttpClientRequest.get(
          new URL("/.well-known/oauth-authorization-server", api).toString(),
        ).pipe(HttpClientRequest.acceptJson),
      )
      // A redirect could hand the answer to another server; fetch fails instead.
      .pipe(Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }));
    if (response.status !== 200) return Option.none<AdvertisedDashboard>();
    return Schema.decodeUnknownOption(AuthorizationServerMetadata)(yield* response.json).pipe(
      Option.filter(({ issuer }) => issuer === api.origin),
      Option.flatMap(({ authorization_endpoint }) =>
        Option.liftThrowable(() => new URL(authorization_endpoint))(),
      ),
      Option.map((dashboard): AdvertisedDashboard => ({
        origin: dashboard.origin,
        isTrusted: isDashboardOf(api, dashboard),
      })),
    );
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.catch((error) =>
      Effect.logDebug(`Reading the server's metadata failed: ${String(error)}`).pipe(
        Effect.as(Option.none<AdvertisedDashboard>()),
      ),
    ),
  );

/**
 * The sign-in address to open in the browser: `uri` when it is a page of the
 * dashboard at `dashboardUrl`, over HTTPS (or plain HTTP on this computer),
 * without a user name or password. The address comes from the API server, so
 * anything else is only printed: an opener hands other schemes to whatever
 * application handles them.
 */
export const openableVerificationUrl = (
  uri: string,
  dashboardUrl: string,
): Option.Option<string> => {
  const dashboard = Option.liftThrowable(() => new URL(dashboardUrl))();
  return Option.liftThrowable(() => new URL(uri))().pipe(
    Option.filter(
      (url) =>
        isSecure(url) &&
        url.username === "" &&
        url.password === "" &&
        Option.exists(dashboard, ({ origin }) => origin === url.origin),
    ),
    Option.map(({ href }) => href),
  );
};

/**
 * Whether `voidhash login` should open the browser: not with `--no-browser`,
 * over SSH, or on a Linux or BSD machine without a graphical display.
 */
export const shouldOpenBrowser = (options: {
  readonly noBrowser: boolean;
  readonly platform: string;
  readonly env: {
    readonly sshConnection: Option.Option<string>;
    readonly sshTty: Option.Option<string>;
    readonly display: Option.Option<string>;
    readonly waylandDisplay: Option.Option<string>;
  };
}) => {
  if (options.noBrowser) return false;
  if (Option.isSome(options.env.sshConnection) || Option.isSome(options.env.sshTty)) return false;
  if (options.platform === "darwin" || options.platform === "win32") return true;
  return Option.isSome(options.env.display) || Option.isSome(options.env.waylandDisplay);
};
