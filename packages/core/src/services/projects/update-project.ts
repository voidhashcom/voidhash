import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  ProjectNotFoundError,
  ProjectServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';
import { _getProjectById, _updateProjectRecord } from './utils';

export const updateProject = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('updateProject')(
    function* (input: { id: string; name: string }) {
      const session = yield* AuthSession;

      // First check if project exists
      const project = yield* _getProjectById(db)(input.id);
      if (!project) {
        return yield* Effect.fail(
          new ProjectNotFoundError({
            projectId: input.id
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.id,
        'project:all',
        `User ${session?.user?.id} is not authorized to update project ${input.id}`
      );

      // Update the project
      yield* _updateProjectRecord(db)({
        id: input.id,
        name: input.name
      });

      yield* Effect.log(`Updated project ${input.id}`);

      return yield* Effect.succeed(undefined);
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
