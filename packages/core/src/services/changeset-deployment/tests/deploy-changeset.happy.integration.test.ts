/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import {
  and,
  changesetDeployments,
  eq,
  paymentProviderConfigurationProducts,
  perks,
  productPerks,
  products
} from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import { AuthSession, type ChangesetSchema } from '@voidhash/shared';
import { Effect, Exit, type Schema } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaymentProviderProductService } from '../../payment-provider-products';
import { PerkService } from '../../perks';
import { ProductPerkService } from '../../product-perks';
import { ProductService } from '../../products';
import { ChangesetDeploymentService } from '../index';

describe.sequential('deployChangeset happy path', () => {
  test('should create resources successfully', async (t) => {
    const h = await IntegrationHarness.init(t);
    const perkSlug = 'test-perk-deployment';
    const productSlug = 'test-product-deployment';

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'create-perk',
          key: 'perk-1',
          payload: {
            slug: perkSlug,
            name: 'Test Perk Deployment'
          }
        },
        {
          changeType: 'create-product',
          key: 'product-1',
          payload: {
            slug: productSlug,
            name: 'Test Product Deployment'
          }
        },
        {
          changeType: 'create-product-perk',
          key: 'product-perk-1',
          payload: {
            productSlug,
            perkSlug
          }
        },
        {
          changeType: 'create-payment-provider-product',
          key: 'ppp-1',
          payload: {
            productSlug,
            providerId: h.resources.paymentProviderConfiguration.providerId,
            configuration: {
              productId: 'prod_123',
              priceId: 'price_123'
            }
          }
        }
      ]
    };

    const input = {
      projectId: h.resources.project.id,
      changeset
    };

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const changesetDeploymentService = yield* ChangesetDeploymentService;
        return yield* changesetDeploymentService.deployChangeset(input);
      }).pipe(
        Effect.provide(ChangesetDeploymentService.Default),
        Effect.provide(PerkService.Default),
        Effect.provide(ProductService.Default),
        Effect.provide(ProductPerkService.Default),
        Effect.provide(PaymentProviderProductService.Default),
        Effect.provideService(
          AuthSession,
          h.createAuthSession({ type: 'user' })
        )
      )
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    // Verify Perk
    const perkRecord = await h.db.primary
      .select()
      .from(perks)
      .where(eq(perks.slug, perkSlug));
    expect(perkRecord).toHaveLength(1);
    expect(perkRecord[0]!.name).toBe('Test Perk Deployment');

    // Verify Product
    const productRecord = await h.db.primary
      .select()
      .from(products)
      .where(
        and(
          eq(products.slug, productSlug),
          eq(products.projectId, h.resources.project.id)
        )
      );
    expect(productRecord).toHaveLength(1);
    expect(productRecord[0]!.name).toBe('Test Product Deployment');

    // Verify Product Perk
    const productPerkRecord = await h.db.primary
      .select()
      .from(productPerks)
      .where(eq(productPerks.productId, productRecord[0]!.id));
    expect(productPerkRecord).toHaveLength(1);
    expect(productPerkRecord[0]!.perkId).toBe(perkRecord[0]!.id);

    // Verify Payment Provider Product
    const pppRecord = await h.db.primary
      .select()
      .from(paymentProviderConfigurationProducts)
      .where(
        eq(paymentProviderConfigurationProducts.productId, productRecord[0]!.id)
      );
    expect(pppRecord).toHaveLength(1);
    expect(pppRecord[0]!.configuration).toEqual({
      productId: 'prod_123',
      priceId: 'price_123'
    });

    // Cleanup
    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paymentProviderConfigurationProducts)
        .where(eq(paymentProviderConfigurationProducts.id, pppRecord[0]!.id));
      await h.db.primary
        .delete(productPerks)
        .where(eq(productPerks.id, productPerkRecord[0]!.id));
      await h.db.primary
        .delete(products)
        .where(eq(products.id, productRecord[0]!.id));
      await h.db.primary.delete(perks).where(eq(perks.id, perkRecord[0]!.id));
      if (value?.id) {
        await h.db.primary
          .delete(changesetDeployments)
          .where(eq(changesetDeployments.id, value.id));
      }
    });
  });

  test('should update resources successfully', async (t) => {
    const h = await IntegrationHarness.init(t);
    const perkSlug = 'test-perk-update';
    const productSlug = 'test-product-update';

    // Seed resources
    const perkId = generateId('perk');
    const productId = generateId('product');
    await h.db.primary.insert(perks).values({
      id: perkId,
      slug: perkSlug,
      name: 'Original Perk',
      projectId: h.resources.project.id
    });
    await h.db.primary.insert(products).values({
      id: productId,
      slug: productSlug,
      name: 'Original Product',
      projectId: h.resources.project.id
    });
    await h.db.primary.insert(paymentProviderConfigurationProducts).values({
      id: generateId('paymentProviderProduct'),
      productId,
      paymentProviderConfigurationId:
        h.resources.paymentProviderConfiguration.id,
      providerProductKey: 'old_price',
      configuration: { priceId: 'old_price' },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'update-perk',
          key: 'perk-update',
          payload: {
            slug: perkSlug,
            name: 'Updated Perk'
          }
        },
        {
          changeType: 'update-product',
          key: 'product-update',
          payload: {
            slug: productSlug,
            name: 'Updated Product'
          }
        },
        {
          changeType: 'update-payment-provider-product',
          key: 'ppp-update',
          payload: {
            productSlug,
            providerId: h.resources.paymentProviderConfiguration.providerId,
            configuration: {
              productId: 'new_prod_123',
              priceId: 'new_price_123'
            }
          }
        }
      ]
    };

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const changesetDeploymentService = yield* ChangesetDeploymentService;
        return yield* changesetDeploymentService.deployChangeset({
          projectId: h.resources.project.id,
          changeset
        });
      }).pipe(
        Effect.provide(ChangesetDeploymentService.Default),
        Effect.provide(PerkService.Default),
        Effect.provide(ProductService.Default),
        Effect.provide(ProductPerkService.Default),
        Effect.provide(PaymentProviderProductService.Default),
        Effect.provideService(
          AuthSession,
          h.createAuthSession({ type: 'user' })
        )
      )
    );

    expect(Exit.isSuccess(result)).toBe(true);

    // Verify Updates
    const updatedPerk = await h.db.primary.query.perks.findFirst({
      where: eq(perks.id, perkId)
    });
    expect(updatedPerk?.name).toBe('Updated Perk');

    const updatedProduct = await h.db.primary.query.products.findFirst({
      where: eq(products.id, productId)
    });
    expect(updatedProduct?.name).toBe('Updated Product');

    const updatedPPP =
      await h.db.primary.query.paymentProviderConfigurationProducts.findFirst({
        where: eq(paymentProviderConfigurationProducts.productId, productId)
      });
    expect(updatedPPP?.configuration).toEqual({
      productId: 'new_prod_123',
      priceId: 'new_price_123'
    });
  });

  test('should delete resources successfully', async (t) => {
    const h = await IntegrationHarness.init(t);
    const perkSlug = 'test-perk-delete';
    const productSlug = 'test-product-delete';

    // Seed resources
    const perkId = generateId('perk');
    const productId = generateId('product');
    const productPerkId = generateId('productPerk');
    const pppId = generateId('paymentProviderProduct');

    await h.db.primary.insert(perks).values({
      id: perkId,
      slug: perkSlug,
      name: 'To Delete Perk',
      projectId: h.resources.project.id
    });
    await h.db.primary.insert(products).values({
      id: productId,
      slug: productSlug,
      name: 'To Delete Product',
      projectId: h.resources.project.id
    });
    await h.db.primary.insert(productPerks).values({
      id: productPerkId,
      perkId,
      productId
    });
    await h.db.primary.insert(paymentProviderConfigurationProducts).values({
      id: pppId,
      productId,
      paymentProviderConfigurationId:
        h.resources.paymentProviderConfiguration.id,
      providerProductKey: 'ppp_delete_key',
      configuration: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'delete-payment-provider-product',
          key: 'ppp-delete',
          payload: {
            productSlug,
            providerId: h.resources.paymentProviderConfiguration.providerId
          }
        },
        {
          changeType: 'delete-product-perk',
          key: 'pp-delete',
          payload: {
            productSlug,
            perkSlug
          }
        },
        {
          changeType: 'delete-product',
          key: 'product-delete',
          payload: {
            slug: productSlug
          }
        },
        {
          changeType: 'delete-perk',
          key: 'perk-delete',
          payload: {
            slug: perkSlug
          }
        }
      ]
    };

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const changesetDeploymentService = yield* ChangesetDeploymentService;
        return yield* changesetDeploymentService.deployChangeset({
          projectId: h.resources.project.id,
          changeset
        });
      }).pipe(
        Effect.provide(ChangesetDeploymentService.Default),
        Effect.provide(PerkService.Default),
        Effect.provide(ProductService.Default),
        Effect.provide(ProductPerkService.Default),
        Effect.provide(PaymentProviderProductService.Default),
        Effect.provideService(
          AuthSession,
          h.createAuthSession({ type: 'user' })
        )
      )
    );

    expect(Exit.isSuccess(result)).toBe(true);

    // Verify Deletions
    const deletedPerk = await h.db.primary.query.perks.findFirst({
      where: eq(perks.id, perkId)
    });
    expect(deletedPerk).toBeUndefined();

    const deletedProduct = await h.db.primary.query.products.findFirst({
      where: eq(products.id, productId)
    });
    expect(deletedProduct).toBeUndefined();

    const deletedPP = await h.db.primary.query.productPerks.findFirst({
      where: eq(productPerks.id, productPerkId)
    });
    expect(deletedPP).toBeUndefined();

    const deletedPPP =
      await h.db.primary.query.paymentProviderConfigurationProducts.findFirst({
        where: eq(paymentProviderConfigurationProducts.id, pppId)
      });
    expect(deletedPPP).toBeUndefined();
  });
});
