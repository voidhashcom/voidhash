import { Db } from '@voidhash/db/effect';
import { AuthSession, ProjectServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { _getProjectBySlug } from './utils';

export const getProjectBySlug = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getProjectBySlug')(
    function* (input: { organizationId: string; slug: string }) {
      const session = yield* AuthSession;

      const project = yield* _getProjectBySlug(db)({
        projectSlug: input.slug,
        organizationId: input.organizationId
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
