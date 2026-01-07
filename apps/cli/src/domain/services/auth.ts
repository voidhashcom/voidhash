import {
  HttpLayerRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { Console, Data, Effect, Layer, PubSub, Queue } from "effect";
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

export class LoginCancelledError extends Data.TaggedError(
  "LoginCancelledError"
)<{
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

const runCallbackServer = (callbackEvents: PubSub.PubSub<CallbackEvent>) =>
  Effect.gen(function* runCallbackServer() {
    // Create the callback route layer
    const CallbackRoute = Layer.effectDiscard(
      Effect.gen(function* CallbackRoute() {
        const router = yield* HttpLayerRouter.HttpRouter;
        yield* router.add(
          "GET",
          "/callback",
          Effect.gen(function* CallbackRoute() {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedUrl = url.parse(req.url as string, true);
            const { query } = parsedUrl;

            if (query.cancelled) {
              yield* callbackEvents.publish({ type: "cancelled" });
              return yield* HttpServerResponse.text("Login cancelled").pipe(
                HttpServerResponse.setHeader(
                  "Access-Control-Allow-Origin",
                  "*"
                ),
                HttpServerResponse.setHeader(
                  "Access-Control-Allow-Methods",
                  "GET, OPTIONS"
                )
              );
            }

            yield* callbackEvents.publish({
              code: query.code as string,
              key: query.key as string,
              type: "success",
            });
            return yield* HttpServerResponse.text("Login successful").pipe(
              HttpServerResponse.setHeader("Access-Control-Allow-Origin", "*"),
              HttpServerResponse.setHeader(
                "Access-Control-Allow-Methods",
                "GET, OPTIONS"
              ),
              HttpServerResponse.setHeader(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization"
              )
            );
          })
        );
      })
    );

    const ServerLive = NodeHttpServer.layer(() => createServer(), {
      host,
      port,
    });

    // Launch the server with the callback route
    return yield* HttpLayerRouter.serve(CallbackRoute).pipe(
      Layer.provide(Layer.mergeAll(ServerLive, NodeContext.layer)),
      Layer.launch
    );
  });

export class Auth extends Effect.Service<Auth>()("voidhash-cli/Auth", {
  dependencies: [CliConfig.Default],
  effect: Effect.gen(function* effect() {
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
    const getSignedInSession = Effect.gen(function* getSignedInSession() {
      const config = yield* cliConfig
        .readConfig()
        .pipe(
          Effect.catchAll(() => Effect.dieMessage("Failed to read config"))
        );

      // If the config file is not found or the api key is not set, we consider the user to be signed out
      const apiKey = config.api_key;
      if (!apiKey) {
        yield* Effect.logInfo(
          "Api key is not set, considering the user to be signed out"
        );
        return yield* Effect.fail(
          new NoSignedInUserError({ message: "No signed in user" })
        );
      }

      const sessionResponse = yield* client.auth.session().pipe(
        Effect.catchTags({
          NotAuthenticatedError: () =>
            new NoSignedInUserError({ message: "No signed in user" }),
        })
      );

      return sessionResponse;
    }).pipe(
      Effect.catchIf(
        (e) => e._tag !== "NoSignedInUserError",
        (e) =>
          Effect.fail(
            new FailedToGetSessionError({
              cause: e,
              message: "Failed to get session",
            })
          )
      )
    );

    const login = Effect.scoped(
      Effect.gen(function* login() {
        const callbackEventsPubSub = yield* PubSub.unbounded<CallbackEvent>();

        // Launch the callback server in a separate fiber to avoid blocking
        yield* Effect.fork(
          Effect.catchAll(runCallbackServer(callbackEventsPubSub), (error) => {
            // biome-ignore lint/suspicious/noConsole: Error logging
            console.log(error);
            return Effect.die(error);
          })
        );

        // Set up the application server with routing
        const redirect = `http://${host}:${port}/callback`;

        const code = nanoid();
        const config = yield* cliConfig
          .readConfig()
          .pipe(
            Effect.catchAll(() => Effect.dieMessage("Failed to read config"))
          );
        const confirmationUrl = new URL(
          `${config.web_url}/studio/auth/devices`
        );
        confirmationUrl.searchParams.append("code", code);
        confirmationUrl.searchParams.append("redirect", redirect);
        yield* Console.log(`Confirmation code: ${code}\n`);
        yield* Console.log(
          `If something goes wrong, copy and paste this URL into your browser: ${confirmationUrl.toString()}\n`
        );
        spawn("open", [confirmationUrl.toString()]);

        // Wait for the callback event
        const callbacksQueue = yield* PubSub.subscribe(callbackEventsPubSub);
        const callbackEvent = yield* Queue.take(callbacksQueue);

        if (callbackEvent.type === "cancelled") {
          return yield* Effect.fail(
            new LoginCancelledError({ message: "Login cancelled" })
          );
        }

        // Store in config
        yield* cliConfig.writeToConfig({ api_key: callbackEvent.key });

        yield* Console.log(
          `Authentication successful! Your key has been stored in your config file.  To view it, type 'cat ~/${CONFIG_FILE_NAME}'.\n);`
        );
      })
    ).pipe(
      Effect.catchIf(
        (e) => e._tag !== "LoginCancelledError",
        (e) =>
          Effect.fail(
            new FailedToLoginError({ cause: e, message: "Failed to login" })
          )
      )
    );

    /**
     * Logs out the current user
     *
     * @returns An Effect that logs out the current user, or fails with a FailedToLogoutError if the logout fails.
     */
    const logout = Effect.gen(function* logout() {
      const config = yield* cliConfig.readConfig();
      if (!config.api_key) {
        yield* Console.log("You are not logged in.");
        return;
      }

      yield* cliConfig.writeToConfig({ api_key: null });
      yield* Console.log("You have been logged out.");
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new FailedToLogoutError({
            cause: e,
            message: "Failed to logout",
          })
        )
      )
    );

    return {
      getSignedInSession,
      login,
      logout,
    } as const;
  }),
}) {}
