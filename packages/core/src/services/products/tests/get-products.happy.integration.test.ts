import { eq, type InsertProduct, products } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProductService } from '../index';

describe.sequential('getProducts happy path', () => {
  test('should get products for a project', async (t) => {
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
              name: 'Test Product',
              type: 1, // Subscription
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Create a test product for different project
            const testProductDifferentProjectId = generateId('product');
            yield* _createProductRecord({
              id: testProductDifferentProjectId,
              projectId: generateId('test'),
              name: 'Test Product Different Project',
              type: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const productsList = yield* productService.getProducts(
              h.resources.project.id
            );

            return {
              productsList,
              testProductId,
              testProductDifferentProjectId
            };
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

    expect(value.productsList.length).toBeGreaterThan(0);
    const testProduct = value.productsList.find(
      (p) => p.id === value.testProductId
    );
    expect(testProduct).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Product'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(products)
        .where(eq(products.id, value.testProductId));
      await h.db.primary
        .delete(products)
        .where(eq(products.id, value.testProductDifferentProjectId));
    });
  });
});
