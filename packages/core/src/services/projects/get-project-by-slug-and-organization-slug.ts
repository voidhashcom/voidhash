import { Db } from '@voidhash/db/effect';
import { AuthSession, ProjectServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { _getOrganizationBySlug, _getProjectBySlug } from './utils';

export const getProjectBySlugAndOrganizationSlug = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProjectBySlugAndOrganizationSlug')(
    function* (input: { organizationSlug: string; projectSlug: string }) {
      const session = yield* AuthSession;
      const organization = yield* _getOrganizationBySlug(db)(
        input.organizationSlug
      );
      if (!organization) {
        return null;
      }

      const project = yield* _getProjectBySlug(db)({
        projectSlug: input.projectSlug,
        organizationId: organization.id
      });

      if (!project) {
        return null;
      }

      // SECURITY: Authorization check for project
      yield* checkProjectPermission(
        project.id,
        'project:all',
        `User ${session?.user?.id} is not authorized to access project ${project.id}`
      );

      return project;
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
