import {
  and,
  asc,
  eq,
  type InsertProductPerk,
  inArray,
  paymentProviderConfigurationProducts,
  productPerks,
  products
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';

export class ProductPerkRepository extends Effect.Service<ProductPerkRepository>()(
  'ProductPerkRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createProductPerk: dbService.makeQuery(
          (execute, productPerk: InsertProductPerk) =>
            execute(
              async (db) => await db.insert(productPerks).values(productPerk)
            )
        ),

        getProductPerksByProductId: dbService.makeQuery(
          (execute, productId: string) =>
            execute(
              async (db) =>
                await db.query.productPerks.findMany({
                  where: eq(productPerks.productId, productId),
                  orderBy: [asc(productPerks.createdAt)]
                })
            )
        ),

        getProductPerksByPaymentProviderConfigurationProductIds:
          dbService.makeQuery(
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
                      eq(productPerks.productId, products.id)
                    )
                    .where(
                      inArray(
                        paymentProviderConfigurationProducts.id,
                        paymentProviderConfigurationProductIds
                      )
                    )
                ).map((row) => row.product_perk)
              )
          ),

        deleteProductPerk: dbService.makeQuery(
          (
            execute,
            { productId, perkId }: { productId: string; perkId: string }
          ) =>
            execute(
              async (db) =>
                await db
                  .delete(productPerks)
                  .where(
                    and(
                      eq(productPerks.productId, productId),
                      eq(productPerks.perkId, perkId)
                    )
                  )
            )
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
