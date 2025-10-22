import type { Product, ProductType } from '@voidhash/api-spec';
import { and, eq, type InsertProduct, products } from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import {
  generateId,
  ProductType as ProductTypeEnum,
  type ProductTypeValue
} from '@voidhash/lib';
import {
  type ActionForbiddenError,
  AuthSession,
  ProductNotFoundError,
  ProductServiceError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import { checkProjectPermission } from '../utils/permissions';

function dbProductTypeToApiProductType(
  type: ProductTypeValue
): typeof ProductType.Type {
  if (type === ProductTypeEnum.Subscription) {
    return 'subscription';
  }
  if (type === ProductTypeEnum.OneTime) {
    return 'one-time';
  }
  if (type === ProductTypeEnum.OneTimeConsumable) {
    return 'one-time-consumable';
  }

  throw new Error(`Invalid product type: ${type}`);
}

export class ProductService extends Effect.Service<ProductService>()(
  'ProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _createProductRecord = dbService.makeQuery(
        (execute, product: InsertProduct) =>
          execute(async (db) => await db.insert(products).values(product))
      );

      const createProduct = (input: { projectId: string; name: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`
            );

            const productId = generateId('product');
            const newProduct = {
              id: productId,
              projectId: input.projectId,
              name: input.name
            };

            yield* dbService.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Create the product
                  yield* _createProductRecord(newProduct);
                })
              )
            );

            yield* Effect.log(
              `Created product ${productId} for project ${input.projectId}`
            );

            return { id: productId };
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductServiceError({
                cause: String(error.cause)
              })
          })
        );

      // Query methods

      const _getProductsByProjectId = dbService.makeQuery(
        (execute, input: { projectId: string }) =>
          execute(
            async (db) =>
              await db.query.products.findMany({
                where: and(eq(products.projectId, input.projectId))
              })
          )
      );

      const getProducts = (
        projectId: string
      ): Effect.Effect<
        (typeof Product.Type)[],
        ActionForbiddenError | ProductServiceError,
        AuthSession
      > =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access products for project ${projectId}`
            );

            const products = yield* _getProductsByProjectId({
              projectId
            });

            return products.map(
              (product) =>
                ({
                  id: product.id,
                  name: product.name,
                  projectId: product.projectId,
                  type: dbProductTypeToApiProductType(
                    product.type as ProductTypeValue
                  )
                }) satisfies typeof Product.Type
            );
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getProductById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.products.findFirst({
              where: eq(products.id, id)
            })
        )
      );

      const getProductById = (id: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const product = yield* _getProductById(id);
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFoundError({
                  message: 'Product not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access product ${id} for project ${product.projectId}`
            );

            return {
              id: product.id,
              name: product.name,
              projectId: product.projectId,
              type: dbProductTypeToApiProductType(
                product.type as ProductTypeValue
              )
            } satisfies typeof Product.Type;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductServiceError({
                cause: String(error.cause)
              })
          })
        );

      // Product perk methods

      const _updateProductRecord = dbService.makeQuery(
        (execute, { id, name }: { id: string; name: string }) =>
          execute(
            async (db) =>
              await db
                .update(products)
                .set({ name, updatedAt: new Date() })
                .where(eq(products.id, id))
          )
      );

      const updateProduct = (input: { productId: string; name: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // Get the product to check authorization
            const existingProduct = yield* _getProductById(input.productId);
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFoundError({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingProduct.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to update product ${input.productId} for project ${existingProduct.projectId}`
            );

            yield* _updateProductRecord({
              id: input.productId,
              name: input.name
            });

            yield* Effect.log(
              `Updated product ${input.productId} for project ${existingProduct.projectId}`
            );

            return;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _deleteProductRecord = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) => await db.delete(products).where(eq(products.id, id))
        )
      );

      const deleteProduct = (input: { productId: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // Get the product to check authorization
            const existingProduct = yield* _getProductById(input.productId);
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFoundError({
                  message: `Product ${input.productId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingProduct.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete product ${input.productId} for project ${existingProduct.projectId}`
            );

            yield* _deleteProductRecord(input.productId);

            yield* Effect.log(
              `Deleted product ${input.productId} for project ${existingProduct.projectId}`
            );
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProductServiceError({
                cause: String(error.cause)
              })
          })
        );

      return {
        // Core actions
        createProduct,
        updateProduct,
        getProducts,
        getProductById,
        deleteProduct
      };
    })
  }
) {}
