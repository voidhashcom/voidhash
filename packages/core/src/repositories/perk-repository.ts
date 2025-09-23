import {
  and,
  eq,
  type InsertPerk,
  inArray,
  paymentProviderConfigurationProducts,
  perks,
  productPerks,
  products
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { Effect } from 'effect';

export class PerkRepository extends Effect.Service<PerkRepository>()(
  'PerkRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createPerk: dbService.makeQuery((execute, perk: InsertPerk) =>
          execute(async (db) => await db.insert(perks).values(perk))
        ),

        getPerks: dbService.makeQuery(
          (
            execute,
            input: { projectId: string; environment: EnvironmentValue }
          ) =>
            execute(
              async (db) =>
                await db.query.perks.findMany({
                  where: and(
                    eq(perks.projectId, input.projectId),
                    eq(perks.environment, input.environment)
                  )
                })
            )
        ),

        getPerkById: dbService.makeQuery((execute, id: string) =>
          execute(
            async (db) =>
              await db.query.perks.findFirst({ where: eq(perks.id, id) })
          )
        ),

        getPerkBySlug: dbService.makeQuery(
          (
            execute,
            input: {
              slug: string;
              projectId: string;
              environment: EnvironmentValue;
            }
          ) =>
            execute(
              async (db) =>
                await db.query.perks.findFirst({
                  where: and(
                    eq(perks.slug, input.slug),
                    eq(perks.projectId, input.projectId),
                    eq(perks.environment, input.environment)
                  )
                })
            )
        ),

        getPerksByPaymentProviderConfigurationProductIds: dbService.makeQuery(
          (execute, paymentProviderConfigurationProductIds: string[]) =>
            execute(async (db) =>
              (
                await db
                  .select()
                  .from(paymentProviderConfigurationProducts)
                  .innerJoin(
                    products,
                    eq(
                      paymentProviderConfigurationProducts.productId,
                      products.id
                    )
                  )
                  .innerJoin(
                    productPerks,
                    eq(products.id, productPerks.productId)
                  )
                  .innerJoin(perks, eq(productPerks.perkId, perks.id))
                  .where(
                    inArray(
                      paymentProviderConfigurationProducts.id,
                      paymentProviderConfigurationProductIds
                    )
                  )
              ).map((row) => row.perk)
            )
        ),

        deletePerk: dbService.makeQuery((execute, id: string) =>
          execute(async (db) => db.delete(perks).where(eq(perks.id, id)))
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
