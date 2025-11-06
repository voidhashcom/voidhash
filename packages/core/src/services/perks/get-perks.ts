import { and, eq, perks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { AuthSession, PerkServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPerksByProjectId = (db: Db) =>
  db.makeQuery((execute, input: { projectId: string }) =>
    execute(
      async (db) =>
        await db.query.perks.findMany({
          where: and(eq(perks.projectId, input.projectId))
        })
    )
  );

export const getPerks = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getPerks')(
    function* (projectId: string) {
      const session = yield* AuthSession;
      // SECURITY: Authorization check
      yield* checkProjectPermission(
        projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access perks for project ${projectId}`
      );
      return yield* _getPerksByProjectId(db)({
        projectId
      });
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
