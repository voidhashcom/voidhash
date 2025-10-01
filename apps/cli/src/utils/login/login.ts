import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import url from 'node:url';
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform';
import { NodeHttpServer } from '@effect/platform-node';
import { Console, Data, Effect, Layer, PubSub, Queue } from 'effect';
import { customAlphabet } from 'nanoid';
import { CONFIG_FILE_NAME, VOIDHASH_URL } from '../../constants';
import { writeToConfig } from '../config/write-to-config';

export class LoginCancelledError extends Data.TaggedError(
  'LoginCancelledError'
)<{
  readonly message: string;
}> {}

const host = '127.0.0.1';
const port = 4004;
const nanoid = customAlphabet('123456789QAZWSXEDCRFVTGBYHNUJMIKOLP', 8);

const ServerLive = NodeHttpServer.layer(() => createServer(), {
  port,
  host
});

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

    // Launch the server
    return yield* Layer.launch(Layer.provide(app, ServerLive));
  });

export const login = Effect.scoped(
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
    yield* writeToConfig({ apiKey: callbackEvent.key });

    yield* Console.log(
      `Authentication successful! Your key has been stored in your config file.  To view it, type 'cat ~/${CONFIG_FILE_NAME}'.\n);`
    );
  })
);
