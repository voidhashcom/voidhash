import { eq, paywalls } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaywallNotFoundError,
  PaywallServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPaywallById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paywalls.findFirst({ where: eq(paywalls.id, id) })
    )
  );

export const getPaywallById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getPaywallById')(
    function* (id: string) {
      const session = yield* AuthSession;
      const paywall = yield* _getPaywallById(db)(id);
      if (!paywall) {
        return yield* Effect.fail(
          new PaywallNotFoundError({
            message: 'Paywall not found'
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        paywall.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access paywall ${id} for project ${paywall.projectId}`
      );

      return paywall;
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
