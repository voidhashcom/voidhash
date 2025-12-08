import { and, eq, paywalls } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { AuthSession, PaywallServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPaywallsByProjectId = (db: Db) =>
  db.makeQuery((execute, input: { projectId: string }) =>
    execute(
      async (db) =>
        await db.query.paywalls.findMany({
          where: and(eq(paywalls.projectId, input.projectId))
        })
    )
  );

export const getPaywalls = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getPaywalls')(
    function* (projectId: string) {
      const session = yield* AuthSession;
      // SECURITY: Authorization check
      yield* checkProjectPermission(
        projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access paywalls for project ${projectId}`
      );
      return yield* _getPaywallsByProjectId(db)({
        projectId
      });
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaywallServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
