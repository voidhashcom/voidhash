import type { User } from '@voidhash/api-spec';

import { AuthenticationError, AuthSession } from '@voidhash/shared';
import { Effect, pipe, type Schema } from 'effect';

export class UserService extends Effect.Service<UserService>()('UserService', {
  dependencies: [],
  effect: Effect.gen(function* () {
    const getUser = () =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;

          if (!session?.user) {
            return yield* Effect.fail(
              new AuthenticationError({
                message: 'User not found',
                cause: 'User not found'
              })
            );
          }

          return {
            ...session.user,
            organizations: session.organizations.map((o) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              logo: null
            })),
            projects: session.projects.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              logo: null,
              organizationId: p.organizationId
            }))
          } satisfies Schema.Schema.Type<typeof User>;
        })
      );

    return {
      getUser
    } as const;
  })
}) {}
