import { and, eq, paymentProviderConfigurations } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthSession,
  PaymentProviderConfigurationServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getPaymentProviderConfigurationsByProjectId = (db: Db) =>
  db.makeQuery((execute, projectId: string) =>
    execute(
      async (db) =>
        await db.query.paymentProviderConfigurations.findMany({
          where: and(eq(paymentProviderConfigurations.projectId, projectId))
        })
    )
  );

export const getPaymentProviderConfigurations = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getPaymentProviderConfigurations')(
    function* (projectId: string) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`
      );

      return yield* _getPaymentProviderConfigurationsByProjectId(db)(projectId);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaymentProviderConfigurationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
