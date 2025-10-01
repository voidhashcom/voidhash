import { BetterAuth } from '@voidhash/auth/effect';
import { UnauthenticatedError } from '@voidhash/shared/errors';
import { Effect } from 'effect';
import { AuthSession } from './auth-service';

export class UserService extends Effect.Service<UserService>()('UserService', {
  dependencies: [],
  effect: Effect.gen(function* () {
    return {
      getUser: (headers: Headers) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const betterAuth = yield* BetterAuth;

          const organizations = yield* betterAuth.use(async (client) =>
            client.api.listOrganizations({
              headers
            })
          );

          if (!session?.user) {
            return yield* Effect.fail(
              new UnauthenticatedError({
                message: 'User not found'
              })
            );
          }

          return {
            ...session.user,
            organizations: organizations.map((o) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              logo: o.logo ?? null,
              createdAt: o.createdAt,
              metadata: o.metadata ?? null
            }))
          };
        })
    };
  })
}) {}
