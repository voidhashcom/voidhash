import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";
import { Data, Effect } from "effect";

import { CliConfig } from "../../../domain/services/cli-config";

export class BetterAuthClientError extends Data.TaggedError(
  "BetterAuthClientError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class BetterAuthClient extends Effect.Service<BetterAuthClient>()(
  "app/BetterAuthClient",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      const cliConfig = yield* CliConfig;
      const config = yield* cliConfig.readConfig();
      const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
        baseURL: config.web_url ?? "https://voidhash.com",
        plugins: [apiKeyClient()],
      });

      return {
        use: <D, E>(
          fn: (
            client: typeof authClient
          ) => Promise<{ error: E; data?: null } | { error?: null; data: D }>
        ) =>
          Effect.tryPromise({
            catch: (error) =>
              new BetterAuthClientError({
                cause: error,
                message: "Failed to use better-auth client",
              }),
            try: async () => {
              const res = await fn(authClient);
              if (res.error) {
                throw res.error;
              }
              return res.data;
            },
          }),
      };
    }),
  }
) {}
