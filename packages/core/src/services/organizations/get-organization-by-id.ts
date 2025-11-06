import { eq, organization } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  OrganizationNotFoundError,
  OrganizationServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
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

export const getOrganizationById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getOrganizationById')(
    function* (id: string) {
      const session = yield* AuthSession;

      const organizationResult = yield* _getOrganizationById(db)(id);
      if (!organizationResult) {
        return yield* Effect.fail(
          new OrganizationNotFoundError({
            message: `Organization with id ${id} not found`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        id,
        'organization:all',
        `User ${session?.user?.id} is not authorized to access organization ${id}`
      );

      return organizationResult;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new OrganizationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
