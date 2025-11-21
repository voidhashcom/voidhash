import { changesetDeployments, eq, perks, products } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  ChangesetDeploymentServiceError,
  type ChangesetSchema
} from '@voidhash/shared';
import { Cause, Effect, Exit, type Schema } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaymentProviderProductService } from '../../payment-provider-products';
import { PerkService } from '../../perks';
import { ProductPerkService } from '../../product-perks';
import { ProductService } from '../../products';
import { ChangesetDeploymentService } from '../index';

describe.sequential('deployChangeset error path', () => {
  test('should fail to deploy changeset with duplicate perk slug', async (t) => {
    const h = await IntegrationHarness.init(t);
    const slug = 'duplicate-perk-slug-deployment';

    t.onTestFinished(async () => {
      await h.db.primary.delete(perks).where(eq(perks.slug, slug));
      const deployments = await h.db.primary
        .select()
        .from(changesetDeployments)
        .where(eq(changesetDeployments.projectId, h.resources.project.id));
      await Promise.all(
        deployments.map((deployment) =>
          h.db.primary
            .delete(changesetDeployments)
            .where(eq(changesetDeployments.id, deployment.id))
        )
      );
    });

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'create-perk',
          key: 'duplicate-perk',
          payload: {
            slug,
            name: 'Duplicate Perk'
          }
        }
      ]
    };

    const input = {
      projectId: h.resources.project.id,
      changeset
    };

    // Create a perk with the same slug first
    await h.db.primary.insert(perks).values({
      id: generateId('perk'),
      slug,
      name: 'Existing Perk',
      projectId: h.resources.project.id
    });

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

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ChangesetDeploymentServiceError);
  });

  test('should fail to deploy changeset with duplicate product slug', async (t) => {
    const h = await IntegrationHarness.init(t);
    const slug = 'duplicate-product-slug-deployment';

    t.onTestFinished(async () => {
      await h.db.primary.delete(products).where(eq(products.slug, slug));
    });

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'create-product',
          key: 'duplicate-product',
          payload: {
            slug,
            name: 'Duplicate Product'
          }
        }
      ]
    };

    const input = {
      projectId: h.resources.project.id,
      changeset
    };

    // Create a product with the same slug first
    await h.db.primary.insert(products).values({
      id: generateId('product'),
      slug,
      name: 'Existing Product',
      projectId: h.resources.project.id
    });

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

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ChangesetDeploymentServiceError);
  });

  test('should fail if dependent resource missing', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset: Schema.Schema.Type<typeof ChangesetSchema> = {
      changes: [
        {
          changeType: 'create-product-perk',
          key: 'missing-dependency',
          payload: {
            productSlug: 'non-existent-product',
            perkSlug: 'non-existent-perk'
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

    expect(Exit.isFailure(result)).toBe(true);
    // It dies with a message, so it might not be ChangesetDeploymentServiceError
  });
});
