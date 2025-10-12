import { BetterAuth } from '@voidhash/auth/effect';
import { Effect } from 'effect';
import { headers } from 'next/headers';
import { ServerRoute } from '@/lib/nextjs-runtime';

const _GET = Effect.fn('GetBetterAuthSession')(function* () {
  const betterAuth = yield* BetterAuth;

  const session = yield* betterAuth
    .use(async (betterAuth) => {
      return await betterAuth.api.getSession({
        headers: await headers()
      });
    })
    .pipe(
      Effect.map((session) => ({ data: session, error: null })),
      Effect.catchAll((e) => {
        return Effect.succeed({
          data: null,
          error: {
            message: e.message
          }
        });
      })
    );

  return session;
});

export const GET = ServerRoute.build(_GET);
