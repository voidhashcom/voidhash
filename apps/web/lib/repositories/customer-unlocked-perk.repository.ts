import {
  type CustomerUnlockedPerk,
  customerUnlockedPerks,
  eq,
  type InsertCustomerUnlockedPerk
} from '@voidhash/db';
import { Effect } from 'effect';
import { Db } from '@/lib/effect/db';

export class CustomerUnlockedPerkRepository extends Effect.Service<CustomerUnlockedPerkRepository>()(
  'CustomerUnlockedPerkRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createCustomerUnlockedPerk: dbService.makeQuery(
          (execute, customerUnlockedPerk: InsertCustomerUnlockedPerk) =>
            execute(async (db) => {
              await db
                .insert(customerUnlockedPerks)
                .values(customerUnlockedPerk);
              return { id: customerUnlockedPerk.id };
            })
        ),
        updateCustomerUnlockedPerk: dbService.makeQuery(
          (
            execute,
            customerUnlockedPerk: Omit<Partial<CustomerUnlockedPerk>, 'id'> & {
              id: string;
            }
          ) =>
            execute(async (db) => {
              await db
                .update(customerUnlockedPerks)
                .set(customerUnlockedPerk)
                .where(eq(customerUnlockedPerks.id, customerUnlockedPerk.id));
              return { id: customerUnlockedPerk.id };
            })
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
