import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/client";
import { Context, Data, Effect, Layer } from "effect";

import { CliConfig } from "../../../domain/services/cli-config";

export class BetterAuthClientError extends Data.TaggedError("BetterAuthClientError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

const make = Effect.gen(function* effect() {
  const cliConfig = yield* CliConfig;
  const config = yield* cliConfig.readConfig();
  const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
    basePath: "/auth/api/auth",
    baseURL: config.web_url ?? "https://voidhash.com",
    plugins: [apiKeyClient()],
  });

  return {
    use: <D, E>(
      fn: (
        client: typeof authClient,
      ) => Promise<{ error: E; data?: null } | { error?: null; data: D }>,
    ) =>
      Effect.gen(function* use() {
        const res = yield* Effect.tryPromise({
          catch: (error) =>
            new BetterAuthClientError({
              cause: error,
              message: "Failed to use better-auth client",
            }),
          try: () => fn(authClient),
        });
        if (res.error) {
          return yield* new BetterAuthClientError({
            cause: res.error,
            message: "Failed to use better-auth client",
          });
        }
        return res.data;
      }),
  };
});

type BetterAuthClientShape = Effect.Success<typeof make>;

export class BetterAuthClient extends Context.Service<BetterAuthClient, BetterAuthClientShape>()(
  "app/BetterAuthClient",
) {
  static Default = Layer.effect(BetterAuthClient, make);
}
