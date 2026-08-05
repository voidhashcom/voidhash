import { NodeServices, NodeHttpServer } from "@effect/platform-node";
import type { AuthSession200 } from "@voidhash/generated-clients";
import { Console, Data, Effect, Layer, PubSub, Context } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { customAlphabet } from "nanoid";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import url from "node:url";

import { CONFIG_FILE_NAME } from "../../constants";
import { ApiClient } from "../../utils/api-client";
import {
  FailedToGetSessionError,
  FailedToLoginError,
  FailedToLogoutError,
  NoSignedInUserError,
} from "../errors/auth";
import { CliConfig } from "./cli-config";

export class LoginCancelledError extends Data.TaggedError("LoginCancelledError")<{
  readonly message: string;
}> {}

const host = "127.0.0.1";
const port = 4004;
const nanoid = customAlphabet("123456789QAZWSXEDCRFVTGBYHNUJMIKOLP", 8);

interface CancelledCallbackEvent {
  type: "cancelled";
}

interface KeyCallbackEvent {
  type: "success";
  code: string;
  key: string;
}

type CallbackEvent = CancelledCallbackEvent | KeyCallbackEvent;

interface AuthShape {
  readonly getSignedInSession: Effect.Effect<
    AuthSession200,
    FailedToGetSessionError | NoSignedInUserError
  >;
  readonly login: Effect.Effect<void, FailedToLoginError | LoginCancelledError>;
  readonly logout: Effect.Effect<void, FailedToLogoutError>;
}

const hasTag = (error: unknown, tag: string): error is { readonly _tag: string } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  typeof error._tag === "string" &&
  error._tag === tag;

const hasNestedTag = (
  error: unknown,
  outerTag: string,
  innerTag: string,
): error is { readonly _tag: string; readonly data: { readonly _tag: string } } =>
  hasTag(error, outerTag) &&
  "data" in error &&
  typeof error.data === "object" &&
  error.data !== null &&
  "_tag" in error.data &&
  typeof error.data._tag === "string" &&
  error.data._tag === innerTag;

const isNoSignedInUserError = (error: unknown): error is NoSignedInUserError =>
  error instanceof NoSignedInUserError || hasTag(error, "NoSignedInUserError");

const runCallbackServer = (callbackEvents: PubSub.PubSub<CallbackEvent>) =>
  Effect.gen(function* runCallbackServer() {
    // Create the callback route layer
    const CallbackRoute = Layer.effectDiscard(
      Effect.gen(function* CallbackRoute() {
        const router = yield* HttpRouter.HttpRouter;
        yield* router.add(
          "GET",
          "/callback",
          Effect.gen(function* CallbackRoute() {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedUrl = url.parse(req.url as string, true);
            const { query } = parsedUrl;

            if (query.cancelled) {
              yield* PubSub.publish(callbackEvents, { type: "cancelled" });
              return HttpServerResponse.text("Login cancelled").pipe(
                HttpServerResponse.setHeader("Access-Control-Allow-Origin", "*"),
                HttpServerResponse.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"),
              );
            }

            yield* PubSub.publish(callbackEvents, {
              code: query.code as string,
              key: query.key as string,
              type: "success",
            });
            return HttpServerResponse.text("Login successful").pipe(
              HttpServerResponse.setHeader("Access-Control-Allow-Origin", "*"),
              HttpServerResponse.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"),
              HttpServerResponse.setHeader(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
              ),
            );
          }),
        );
      }),
    );

    const ServerLive = NodeHttpServer.layer(() => createServer(), {
      host,
      port,
    });

    // Launch the server with the callback route
    return yield* HttpRouter.serve(CallbackRoute).pipe(
      Layer.provide(Layer.mergeAll(ServerLive, NodeServices.layer)),
      Layer.launch,
    );
  });

const make = Effect.gen(function* effect() {
  const client = yield* ApiClient;
  const cliConfig = yield* CliConfig;
  /**
   * Retrieves the currently signed-in user from the local configuration and the BetterAuth service.
   *
   * Attempts to read the API key from the user's config file. If no API key is found, or if the session
   * cannot be retrieved or does not contain a user, a `NoSignedInUserError` is thrown.
   * If the session retrieval fails for other reasons, a `FailedToGetSessionError` is thrown.
   *
   * @returns {Effect.Effect<unknown, NoSignedInUserError | FailedToGetSessionError, { name: string; email: string }>}
   *   An Effect that yields the signed-in user's information, or fails with an appropriate error.
   */
  const getSignedInSession: AuthShape["getSignedInSession"] = Effect.gen(
    function* getSignedInSession() {
      yield* Effect.logDebug("Reading CLI config for session check");
      const config = (yield* cliConfig
        .readConfig()
        .pipe(Effect.catch(() => Effect.die("Failed to read config"))))!;

      // If the config file is not found or the api key is not set, we consider the user to be signed out
      const apiKey = config.api_key;
      if (!apiKey) {
        yield* Effect.logDebug("No API key found in config");
        return yield* Effect.fail(new NoSignedInUserError({ message: "No signed in user" }));
      }

      yield* Effect.logDebug("Fetching session from API");
      const sessionResponse = yield* client.authSession().pipe(
        Effect.tap((session) => Effect.logDebug(`Session retrieved for user: ${session.name}`)),
        Effect.catchIf(
          (error) => hasNestedTag(error, "AuthSession500", "NotAuthenticatedError"),
          () => Effect.fail(new NoSignedInUserError({ message: "No signed in user" })),
        ),
      );

      return sessionResponse;
    },
  ).pipe(
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

  const login: AuthShape["login"] = Effect.scoped(
    Effect.gen(function* login() {
      yield* Effect.logDebug("Starting login flow");
      const callbackEventsPubSub = yield* PubSub.unbounded<CallbackEvent>();

      // Launch the callback server in a separate fiber to avoid blocking
      yield* Effect.logDebug(`Starting callback server on ${host}:${port}`);
      yield* Effect.forkChild(
        Effect.catch(runCallbackServer(callbackEventsPubSub), (error) => {
          console.log(error);
          return Effect.die(error);
        }),
      );

      // Set up the application server with routing
      const redirect = `http://${host}:${port}/callback`;

      const code = nanoid();
      const config = (yield* cliConfig
        .readConfig()
        .pipe(Effect.catch(() => Effect.die("Failed to read config"))))!;
      const confirmationUrl = new URL(`${config.web_url}/auth/devices`);
      confirmationUrl.searchParams.append("code", code);
      confirmationUrl.searchParams.append("redirect", redirect);

      yield* Effect.logDebug(`Opening browser for authentication: ${confirmationUrl.toString()}`);
      yield* Console.log(`Confirmation code: ${code}\n`);
      yield* Console.log(
        `If something goes wrong, copy and paste this URL into your browser: ${confirmationUrl.toString()}\n`,
      );
      spawn("open", [confirmationUrl.toString()]);

      // Wait for the callback event
      yield* Effect.logDebug("Waiting for callback from browser");
      const subscription = yield* PubSub.subscribe(callbackEventsPubSub);
      const callbackEvent = yield* PubSub.take(subscription);

      if (callbackEvent.type === "cancelled") {
        yield* Effect.logDebug("Login cancelled by user");
        return yield* Effect.fail(new LoginCancelledError({ message: "Login cancelled" }));
      }

      // Store in config
      yield* Effect.logDebug("Storing API key in config");
      yield* cliConfig.writeToConfig({ api_key: callbackEvent.key });

      yield* Console.log(
        `Authentication successful! Your key has been stored in your config file.  To view it, type 'cat ~/${CONFIG_FILE_NAME}'.\n);`,
      );
    }),
  ).pipe(
    Effect.withSpan("Auth.login"),
    Effect.catchIf(
      (e) => e._tag !== "LoginCancelledError",
      (e) => Effect.fail(new FailedToLoginError({ cause: e, message: "Failed to login" })),
    ),
  );

  /**
   * Logs out the current user
   *
   * @returns An Effect that logs out the current user, or fails with a FailedToLogoutError if the logout fails.
   */
  const logout: AuthShape["logout"] = Effect.gen(function* logout() {
    yield* Effect.logDebug("Starting logout");
    const config = yield* cliConfig.readConfig();
    if (!config.api_key) {
      yield* Effect.logDebug("No API key found, user not logged in");
      yield* Console.log("You are not logged in.");
      return;
    }

    yield* Effect.logDebug("Clearing API key from config");
    yield* cliConfig.writeToConfig({ api_key: null });
    yield* Console.log("You have been logged out.");
  }).pipe(
    Effect.withSpan("Auth.logout"),
    Effect.catch((e) =>
      Effect.fail(
        new FailedToLogoutError({
          cause: e,
          message: "Failed to logout",
        }),
      ),
    ),
  );

  return {
    getSignedInSession,
    login,
    logout,
  } satisfies AuthShape;
});

export class Auth extends Context.Service<Auth, AuthShape>()("voidhash-cli/Auth") {
  static Default = Layer.effect(Auth, make).pipe(Layer.provide(CliConfig.Default));
}
