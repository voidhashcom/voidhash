import { createAuthClient } from 'better-auth/client';
import { apiKeyClient } from 'better-auth/client/plugins';
import { Data, Effect } from 'effect';
import { VOIDHASH_URL } from './constants';

export class BetterAuthClientError extends Data.TaggedError(
  'BetterAuthClientError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: VOIDHASH_URL,
  plugins: [apiKeyClient()]
});

export class BetterAuthClient extends Effect.Service<BetterAuthClient>()(
  'app/BetterAuthClient',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        use: <D, E>(
          fn: (
            client: typeof authClient
          ) => Promise<{ error: E; data?: null } | { error?: null; data: D }>
        ) =>
          Effect.tryPromise({
            try: async () => {
              const res = await fn(authClient);
              if (res.error) {
                throw res.error;
              }
              return res.data;
            },
            catch: (error) =>
              new BetterAuthClientError({
                message: 'Failed to use better-auth client',
                cause: error
              })
          })
      };
    })
  }
) {}
