import { Db, TransactionContext } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { PerkNotFound, ProductNotFound } from '@voidhash/shared/errors';
import { Effect } from 'effect';
import { PerkRepository } from '../repositories/perk-repository';
import { ProductPerkRepository } from '../repositories/product-perk-repository';
import { ProductRepository } from '../repositories/product-repository';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';
import { Environment } from './environment-service';

export class ProductService extends Effect.Service<ProductService>()(
  'ProductService',
  {
    dependencies: [ProductRepository.Default, ProductPerkRepository.Default],
    effect: Effect.gen(function* () {
      return {
        // Core actions
        createProduct: (input: { projectId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const environment = yield* Environment;
            const db = yield* Db;

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
              name: input.name,
              environment
            };

            yield* db.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  // Create the product
                  yield* productRepository.createProduct(newProduct);
                })
              )
            );

            yield* Effect.log(
              `Created product ${productId} for project ${input.projectId}`
            );

            return yield* Effect.succeed({ id: productId });
          }),

        deleteProduct: (input: { productId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;

            // Get the product to check authorization
            const existingProduct = yield* productRepository.getProductById(
              input.productId
            );
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFound({
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

            yield* productRepository.deleteProduct(input.productId);

            yield* Effect.log(
              `Deleted product ${input.productId} for project ${existingProduct.projectId}`
            );

            return yield* Effect.succeed(undefined);
          }),

        updateProduct: (input: { productId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;

            // Get the product to check authorization
            const existingProduct = yield* productRepository.getProductById(
              input.productId
            );
            if (!existingProduct) {
              return yield* Effect.fail(
                new ProductNotFound({
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

            yield* productRepository.updateProduct({
              id: input.productId,
              name: input.name
            });

            yield* Effect.log(
              `Updated product ${input.productId} for project ${existingProduct.projectId}`
            );

            return yield* Effect.succeed(undefined);
          }),

        // Query methods
        getProducts: (projectId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            const productRepository = yield* ProductRepository;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access products for project ${projectId}`
            );

            return yield* productRepository.getProducts({
              projectId,
              environment
            });
          }),

        getProductById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const product = yield* productRepository.getProductById(id);
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
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

            return product;
          }),

        // Product perk methods
        getProductPerksByProductId: (productId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const productPerkRepository = yield* ProductPerkRepository;
            const product = yield* productRepository.getProductById(productId);
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
                  message: 'Product not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              product.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
            );

            return yield* productPerkRepository.getProductPerksByProductId(
              productId
            );
          }),

        createProductPerk: (input: { productId: string; perkId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productPerkRepository = yield* ProductPerkRepository;
            const productRepository = yield* ProductRepository;
            const perkRepository = yield* PerkRepository;

            // Get product to check authorization
            const product = yield* productRepository.getProductById(
              input.productId
            );
            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
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
            const perk = yield* perkRepository.getPerkById(input.perkId);
            if (!perk) {
              return yield* Effect.fail(
                new PerkNotFound({
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

            yield* productPerkRepository.createProductPerk(newProductPerk);

            yield* Effect.log(
              `Created product perk ${newProductPerk.id} for product ${input.productId}`
            );

            return yield* Effect.succeed({ id: newProductPerk.id });
          }),

        deleteProductPerk: (input: { productId: string; perkId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const productRepository = yield* ProductRepository;
            const productPerkRepository = yield* ProductPerkRepository;

            const product = yield* productRepository.getProductById(
              input.productId
            );

            if (!product) {
              return yield* Effect.fail(
                new ProductNotFound({
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

            yield* productPerkRepository.deleteProductPerk({
              productId: input.productId,
              perkId: input.perkId
            });

            yield* Effect.log(
              `Deleted product perk ${input.perkId} from product ${input.productId}`
            );

            return yield* Effect.succeed(undefined);

            // TODO: Think about deleting already granted perks.
          })
      };
    })
  }
) {}
