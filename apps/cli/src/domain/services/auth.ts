import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import url from 'node:url';
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform';
import { NodeContext, NodeHttpServer } from '@effect/platform-node';
import { Console, Data, Effect, Layer, PubSub, Queue } from 'effect';
import { customAlphabet } from 'nanoid';
import { CONFIG_FILE_NAME, VOIDHASH_URL } from '../../constants';
import { ApiClient } from '../../utils/api-client';
import {
  FailedToGetSessionError,
  FailedToLoginError,
  FailedToLogoutError,
  NoSignedInUserError
} from '../errors/auth';
import { CliConfig } from './cli-config';

export class LoginCancelledError extends Data.TaggedError(
  'LoginCancelledError'
)<{
  readonly message: string;
}> {}

const host = '127.0.0.1';
const port = 4004;
const nanoid = customAlphabet('123456789QAZWSXEDCRFVTGBYHNUJMIKOLP', 8);

type CancelledCallbackEvent = {
  type: 'cancelled';
};

type KeyCallbackEvent = {
  type: 'success';
  code: string;
  key: string;
};

type CallbackEvent = CancelledCallbackEvent | KeyCallbackEvent;

const runCallbackServer = (callbackEvents: PubSub.PubSub<CallbackEvent>) =>
  Effect.gen(function* () {
    const router = HttpRouter.empty.pipe(
      HttpRouter.get(
        '/callback',
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest;
          const parsedUrl = url.parse(req.url as string, true);
          const query = parsedUrl.query;

          if (query.cancelled) {
            yield* callbackEvents.publish({ type: 'cancelled' });
            return yield* HttpServerResponse.text('Login cancelled').pipe(
              HttpServerResponse.setHeader('Access-Control-Allow-Origin', '*'),
              HttpServerResponse.setHeader(
                'Access-Control-Allow-Methods',
                'GET, OPTIONS'
              )
            );
          }

          yield* callbackEvents.publish({
            type: 'success',
            code: query.code as string,
            key: query.key as string
          });
          return yield* HttpServerResponse.text('Login successful').pipe(
            HttpServerResponse.setHeader('Access-Control-Allow-Origin', '*'),
            HttpServerResponse.setHeader(
              'Access-Control-Allow-Methods',
              'GET, OPTIONS'
            ),
            HttpServerResponse.setHeader(
              'Access-Control-Allow-Headers',
              'Content-Type, Authorization'
            )
          );
        })
      )
    );

    const app = router.pipe(HttpServer.serve());

    const ServerLive = NodeHttpServer.layer(() => createServer(), {
      port,
      host
    });

    // Launch the server with all dependencies provided
    return yield* Layer.launch(
      Layer.provide(app, Layer.mergeAll(ServerLive, NodeContext.layer))
    );
  });

export class Auth extends Effect.Service<Auth>()('voidhash-cli/Auth', {
  dependencies: [CliConfig.Default],
  effect: Effect.gen(function* () {
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
    const getSignedInSession = Effect.gen(function* () {
      const config = yield* cliConfig.readConfig().pipe(
        Effect.catchTag('ConfigFileNotFoundError', () => Effect.succeed(null)),
        Effect.catchAll(() => Effect.dieMessage('Failed to read config'))
      );

      // If the config file is not found or the api key is not set, we consider the user to be signed out
      const apiKey = config?.apiKey;
      if (!apiKey) {
        yield* Effect.logInfo(
          'Api key is not set, considering the user to be signed out'
        );
        return yield* Effect.fail(
          new NoSignedInUserError({ message: 'No signed in user' })
        );
      }

      const sessionResponse = yield* client.auth.session({
        // headers: {
        //   'x-api-key': apiKey
        // }
      });

      return sessionResponse;
    }).pipe(
      Effect.catchIf(
        (e) => e._tag !== 'NoSignedInUserError',
        (e) =>
          Effect.fail(
            new FailedToGetSessionError({
              message: 'Failed to get session',
              cause: e
            })
          )
      )
    );

    const login = Effect.scoped(
      Effect.gen(function* () {
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
        const confirmationUrl = new URL(`${VOIDHASH_URL}/auth/devices`);
        confirmationUrl.searchParams.append('code', code);
        confirmationUrl.searchParams.append('redirect', redirect);
        yield* Console.log(`Confirmation code: ${code}\n`);
        yield* Console.log(
          `If something goes wrong, copy and paste this URL into your browser: ${confirmationUrl.toString()}\n`
        );
        spawn('open', [confirmationUrl.toString()]);

        // Wait for the callback event
        const callbacksQueue = yield* PubSub.subscribe(callbackEventsPubSub);
        const callbackEvent = yield* Queue.take(callbacksQueue);

        if (callbackEvent.type === 'cancelled') {
          return yield* Effect.fail(
            new LoginCancelledError({ message: 'Login cancelled' })
          );
        }

        // Store in config
        yield* cliConfig.writeToConfig({ apiKey: callbackEvent.key });

        yield* Console.log(
          `Authentication successful! Your key has been stored in your config file.  To view it, type 'cat ~/${CONFIG_FILE_NAME}'.\n);`
        );
      })
    ).pipe(
      Effect.catchIf(
        (e) => e._tag !== 'LoginCancelledError',
        (e) =>
          Effect.fail(
            new FailedToLoginError({ message: 'Failed to login', cause: e })
          )
      )
    );

    /**
     * Logs out the current user
     *
     * @returns An Effect that logs out the current user, or fails with a FailedToLogoutError if the logout fails.
     */
    const logout = Effect.gen(function* () {
      const config = yield* cliConfig.readConfig();
      if (!config.apiKey) {
        yield* Console.log('You are not logged in.');
        return;
      }

      yield* cliConfig.writeToConfig({ apiKey: null });
      yield* Console.log('You have been logged out.');
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new FailedToLogoutError({
            message: 'Failed to logout',
            cause: e
          })
        )
      )
    );

    return {
      getSignedInSession,
      login,
      logout
    } as const;
  })
}) {}
