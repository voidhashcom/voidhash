import {
  and,
  asc,
  eq,
  type InsertProductPerk,
  perks,
  productPerks,
  products
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  ProductPerkServiceError,
  ProductPerkValidationError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import { checkProjectPermission } from '../utils/permissions';

export class ProductPerkService extends Effect.Service<ProductPerkService>()(
  'ProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      const _getProductById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.products.findFirst({
              where: eq(products.id, id)
            })
        )
      );

      const _getPerkById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.perks.findFirst({ where: eq(perks.id, id) })
        )
      );

      const _createProductPerkRecord = dbService.makeQuery(
        (execute, productPerk: InsertProductPerk) =>
          execute(
            async (db) => await db.insert(productPerks).values(productPerk)
          )
      );

      const createProductPerk = (input: {
        productId: string;
        perkId: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // Get product to check authorization
            const product = yield* _getProductById(input.productId);
            if (!product) {
              return yield* Effect.fail(
                new ProductPerkValidationError({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`
            );

            // Validate perk exists (this also checks authorization)
            const perk = yield* _getPerkById(input.perkId);
            if (!perk) {
              return yield* Effect.fail(
                new ProductPerkValidationError({
                  message: `Perk ${input.perkId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              perk.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`
            );

            const newProductPerk = {
              id: generateId('productPerk'),
              productId: input.productId,
              perkId: input.perkId
            };

            yield* _createProductPerkRecord(newProductPerk);

            yield* Effect.log(
              `Created product perk ${newProductPerk.id} for product ${input.productId}`
            );

            return { id: newProductPerk.id };
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductPerkServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getProductPerksByProductId = dbService.makeQuery(
        (execute, productId: string) =>
          execute(
            async (db) =>
              await db.query.productPerks.findMany({
                where: eq(productPerks.productId, productId),
                orderBy: [asc(productPerks.createdAt)]
              })
          )
      );

      const getProductPerksByProductId = (productId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const product = yield* _getProductById(productId);
            if (!product) {
              return yield* Effect.fail(
                new ProductPerkValidationError({
                  message: `Product ${productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
            );

            return yield* _getProductPerksByProductId(productId);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductPerkServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _deleteProductPerkRecord = dbService.makeQuery(
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
      );

      const deleteProductPerk = (input: {
        productId: string;
        perkId: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const product = yield* _getProductById(input.productId);

            if (!product) {
              return yield* Effect.fail(
                new ProductPerkValidationError({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete product perks for product ${input.productId}`
            );

            yield* _deleteProductPerkRecord({
              productId: input.productId,
              perkId: input.perkId
            });

            yield* Effect.log(
              `Deleted product perk ${input.perkId} from product ${input.productId}`
            );

            return;

            // TODO: Think about deleting already granted perks.
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductPerkServiceError({
                cause: String(error.cause)
              })
          })
        );

      return {
        createProductPerk,
        getProductPerksByProductId,
        deleteProductPerk
      } as const;
    })
  }
) {}
