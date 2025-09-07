import * as schema from '@voidhash/db/schema';
import { APP_DOMAIN } from '@voidhash/lib/constants';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { apiKey, organization } from 'better-auth/plugins';
import { Data, Effect } from 'effect';
import { Db } from './db';

export class BetterAuthError extends Data.TaggedError('BetterAuthError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class BetterAuth extends Effect.Service<BetterAuth>()('app/BetterAuth', {
  dependencies: [Db.Default],
  effect: Effect.gen(function* () {
    const dbService = yield* Db;
    const auth = yield* dbService.use(async (db) =>
      betterAuth({
        baseURL: APP_DOMAIN,
        database: drizzleAdapter(db, {
          provider: 'mysql',
          schema
        }),
        socialProviders: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string
          }
        },
        emailAndPassword: {
          enabled: true
        },
        plugins: [organization(), apiKey(), nextCookies()]
      })
    );

    return {
      use: <A>(fn: (client: typeof auth) => Promise<A>) =>
        Effect.tryPromise({
          try: () => fn(auth),
          catch: (error) =>
            new BetterAuthError({
              message: 'Failed to use better-auth',
              cause: error
            })
        })
    };
  })
}) {}
