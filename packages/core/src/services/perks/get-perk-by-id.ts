import { eq, perks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PerkNotFoundError,
  PerkServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPerkById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) => await db.query.perks.findFirst({ where: eq(perks.id, id) })
    )
  );

export const getPerkById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getPerkById')(
    function* (id: string) {
      const session = yield* AuthSession;
      const perk = yield* _getPerkById(db)(id);
      if (!perk) {
        return yield* Effect.fail(
          new PerkNotFoundError({
            message: 'Perk not found'
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        perk.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access perk ${id} for project ${perk.projectId}`
      );

      return perk;
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
