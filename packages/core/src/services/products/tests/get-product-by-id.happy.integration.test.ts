import { eq, type InsertProduct, products } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProductService } from '../index';

describe.sequential('getProductById happy path', () => {
  test('should get product by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const productService = yield* ProductService;
            const dbService = yield* Db;

            const _createProductRecord = dbService.makeQuery(
              (execute, product: InsertProduct) =>
                execute(async (db) => {
                  await db.insert(products).values(product);
                  return { id: product.id };
                })
            );

            // Create a test product
            const testProductId = generateId('product');
            yield* _createProductRecord({
              id: testProductId,
              projectId: h.resources.project.id,
              name: 'Test Product By ID',
              slug: 'test-product-by-id',
              type: 1, // Subscription
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const product = yield* productService.getProductById(testProductId);
            return { product, testProductId };
          }),
          Effect.provide(ProductService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value.product).toMatchObject({
      id: value.testProductId,
      name: 'Test Product By ID',
      slug: 'test-product-by-id',
      projectId: h.resources.project.id
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(products)
        .where(eq(products.id, value.testProductId));
    });
  });
});
