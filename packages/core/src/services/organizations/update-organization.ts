import { eq, organization } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  OrganizationNotFoundError,
  OrganizationServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { BetterAuth } from '../../better-auth/better-auth-effect';
import { checkOrganizationPermission } from '../../utils/permissions';

const _getOrganizationById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.organization.findFirst({
          where: eq(organization.id, id)
        })
    )
  );

export const updateOrganization = Effect.gen(function* () {
  const betterAuth = yield* BetterAuth;
  const db = yield* Db;
  return Effect.fn('updateOrganization')(
    function* (
      input: { organizationId: string; name: string },
      cookie: string
    ) {
      const session = yield* AuthSession;
      const organizationResult = yield* _getOrganizationById(db)(
        input.organizationId
      );
      if (!organizationResult) {
        return yield* Effect.fail(
          new OrganizationNotFoundError({
            message: `Organization with id ${input.organizationId} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        input.organizationId,
        'organization:all',
        `User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`
      );

      yield* betterAuth.use(async (client) =>
        client.api.updateOrganization({
          headers: new Headers({
            cookie
          }),
          body: {
            organizationId: input.organizationId,
            data: {
              name: input.name
            }
          }
        })
      );

      return yield* Effect.succeed(undefined);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new OrganizationServiceError({
              cause: String(error.cause)
            }),
          BetterAuthError: (error) =>
            new OrganizationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
