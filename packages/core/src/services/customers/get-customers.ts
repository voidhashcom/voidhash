import { and, type CustomerTypeValue, customers, eq } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { AuthSession, CustomerServiceError } from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getCustomers = (db: Db) =>
  db.makeQuery(
    (
      execute,
      {
        projectId,
        type
      }: {
        projectId: string;
        type: CustomerTypeValue | null;
      }
    ) =>
      execute(
        async (db) =>
          await db.query.customers.findMany({
            where: and(
              eq(customers.projectId, projectId),
              type !== null ? eq(customers.type, type) : undefined
            )
          })
      )
  );

export const getCustomers = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getCustomers')(
    function* (input: { projectId: string; type?: CustomerTypeValue }) {
      const session = yield* AuthSession;
      yield* checkProjectPermission(
        input.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access customers for project ${input.projectId}`
      );
      return yield* _getCustomers(db)({
        projectId: input.projectId,
        type: input.type ?? null
      });
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new CustomerServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
