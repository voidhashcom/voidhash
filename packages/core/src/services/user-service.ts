import type { User } from '@voidhash/api-spec';

import { AuthenticationError, AuthSession } from '@voidhash/shared';
import { Effect, Option, pipe } from 'effect';

export class UserService extends Effect.Service<UserService>()('UserService', {
  dependencies: [],
  effect: Effect.gen(function* () {
    const getUser = () =>
      pipe(
        Effect.gen(function* () {
          const maybeSession = yield* Effect.serviceOption(AuthSession);
          if (Option.isNone(maybeSession) || !maybeSession.value.user) {
            return yield* Effect.fail(
              new AuthenticationError({
                message: 'User not found',
                cause: 'User not found'
              })
            );
          }
          const session = maybeSession.value;
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
          } satisfies typeof User.Type;
        })
      );

    return {
      getUser
    } as const;
  })
}) {}
