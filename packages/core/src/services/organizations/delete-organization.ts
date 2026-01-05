import { AuthSession, OrganizationServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { BetterAuth } from '../../better-auth/better-auth-effect';
import { checkOrganizationPermission } from '../../utils/permissions';

export const deleteOrganization = Effect.gen(function* () {
  const betterAuth = yield* BetterAuth;
  return Effect.fn('deleteOrganization')(
    function* (input: { organizationId: string }, cookie: string) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        input.organizationId,
        'organization:all',
        `User ${session?.user?.id} is not authorized to delete organization ${input.organizationId}`
      );

      yield* betterAuth.use(async (client) =>
        client.api.deleteOrganization({
          headers: new Headers({
            cookie
          }),
          body: { organizationId: input.organizationId }
        })
      );

      return yield* Effect.succeed(undefined);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          BetterAuthError: (error) =>
            new OrganizationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
