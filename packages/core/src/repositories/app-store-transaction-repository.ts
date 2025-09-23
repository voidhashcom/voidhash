import {
  appStoreTransactions,
  eq,
  type InsertAppStoreTransaction
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';

export class AppStoreTransactionRepository extends Effect.Service<AppStoreTransactionRepository>()(
  'AppStoreTransactionRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createAppStoreTransaction: dbService.makeQuery(
          (execute, appStoreTransaction: InsertAppStoreTransaction) =>
            execute(
              async (db) =>
                await db
                  .insert(appStoreTransactions)
                  .values(appStoreTransaction)
            )
        ),

        getAppStoreTransactionByTransactionId: dbService.makeQuery(
          (execute, transactionId: string) =>
            execute(
              async (db) =>
                await db.query.appStoreTransactions.findFirst({
                  where: eq(appStoreTransactions.transactionId, transactionId)
                })
            )
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
