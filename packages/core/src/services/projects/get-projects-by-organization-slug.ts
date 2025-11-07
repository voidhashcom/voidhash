import { Db } from '@voidhash/db/effect';
import { AuthSession, ProjectServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkOrganizationPermission } from '../../utils/permissions';
import { _getOrganizationBySlug, _getProjectsByOrganizationId } from './utils';

export const getProjectsByOrganizationSlug = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProjectsByOrganizationSlug')(
    function* (organizationSlug: string) {
      const session = yield* AuthSession;
      const organization = yield* _getOrganizationBySlug(db)(organizationSlug);
      if (!organization) {
        return null;
      }

      // SECURITY: Authorization check for organization
      yield* checkOrganizationPermission(
        organization.id,
        'organization:all',
        `User ${session?.user?.id} is not authorized to access organization ${organization.id}`
      );

      return yield* _getProjectsByOrganizationId(db)(organization.id);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProjectServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
