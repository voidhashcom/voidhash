import {
  type CheckoutSession,
  checkoutSessions,
  eq,
  type InsertCheckoutSession
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';

export class CheckoutSessionRepository extends Effect.Service<CheckoutSessionRepository>()(
  'CheckoutSessionRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createCheckoutSession: dbService.makeQuery(
          (execute, session: InsertCheckoutSession) =>
            execute(
              async (db) => await db.insert(checkoutSessions).values(session)
            )
        ),
        getCheckoutSessionById: dbService.makeQuery((execute, id: string) =>
          execute(
            async (db) =>
              await db.query.checkoutSessions.findFirst({
                where: eq(checkoutSessions.id, id)
              })
          )
        ),
        updateCheckoutSession: dbService.makeQuery(
          (
            execute,
            session: Omit<Partial<CheckoutSession>, 'id'> & { id: string }
          ) =>
            execute(
              async (db) =>
                await db
                  .update(checkoutSessions)
                  .set(session)
                  .where(eq(checkoutSessions.id, session.id))
            )
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
