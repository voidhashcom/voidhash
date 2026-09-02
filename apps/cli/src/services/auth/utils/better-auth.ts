import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CliConfig } from "../../../domain/services/cli-config";
import * as Schema from "effect/Schema";

export class BetterAuthClientError extends Schema.TaggedErrorClass<BetterAuthClientError>(
  "BetterAuthClientError",
)("BetterAuthClientError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

const make = Effect.fn("make")(function* effect() {
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
      Effect.fn("use")(function* use() {
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
      })(),
  };
})();

type BetterAuthClientShape = Effect.Success<typeof make>;

export class BetterAuthClient extends Context.Service<BetterAuthClient, BetterAuthClientShape>()(
  "app/BetterAuthClient",
) {
  static Default = Layer.effect(BetterAuthClient, make);
}
