import { eq, organization } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  OrganizationNotFoundError,
  OrganizationServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkOrganizationPermission } from '../../utils/permissions';

const _getOrganizationBySlug = (db: Db) =>
  db.makeQuery((execute, slug: string) =>
    execute(
      async (db) =>
        await db.query.organization.findFirst({
          where: eq(organization.slug, slug)
        })
    )
  );

export const getOrganizationBySlug = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getOrganizationBySlug')(
    function* (slug: string) {
      const session = yield* AuthSession;

      const organizationResult = yield* _getOrganizationBySlug(db)(slug);
      if (!organizationResult) {
        return yield* Effect.fail(
          new OrganizationNotFoundError({
            message: `Organization with slug ${slug} not found`
          })
        );
      }
      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        organizationResult.id,
        'organization:all',
        `User ${session?.user?.id} is not authorized to access organization ${organizationResult.id}`
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
