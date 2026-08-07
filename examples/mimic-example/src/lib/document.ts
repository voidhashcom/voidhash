import { Data, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { createClientDocument, WebSocketTransport } from "@voidhash/mimic/client";
import { ExamplePresencePrimitive, MimicExampleSchema, type ExamplePresence } from "../shared";
import { exampleServerUrl } from "./serverConfig";

const TokenResponse = Schema.Struct({
  token: Schema.String,
  url: Schema.String,
});

class TokenRequestError extends Data.TaggedError("TokenRequestError")<{
  readonly message: string;
}> {}

const fetchToken = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get(`${exampleServerUrl}/api/token`);
  if (response.status < 200 || response.status >= 300) {
    return yield* new TokenRequestError({
      message: `Failed to fetch token: ${response.status}`,
    });
  }
  return yield* HttpClientResponse.schemaBodyJson(TokenResponse)(response);
}).pipe(Effect.provide(FetchHttpClient.layer));

/**
 * Creates a client document connected to the example server, refreshing the
 * websocket auth token on every reconnect after the initial handshake.
 */
export const createDocument = (initialPresence?: ExamplePresence) =>
  Effect.gen(function* () {
    const { token, url } = yield* fetchToken;
    let nextToken: string | null = token;

    const takeToken = Effect.gen(function* () {
      if (nextToken !== null) {
        const current = nextToken;
        nextToken = null;
        return current;
      }
      const auth = yield* fetchToken;
      return auth.token;
    });

    return createClientDocument({
      primitive: MimicExampleSchema,
      presence: {
        primitive: ExamplePresencePrimitive,
        initial: initialPresence,
      },
      transport: new WebSocketTransport({
        url,
        token: () => Effect.runPromise(takeToken),
      }),
    });
  });
