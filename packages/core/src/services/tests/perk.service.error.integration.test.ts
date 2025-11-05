import { eq, perks } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PerkNotFoundError,
  PerkSlugAlreadyExistsError
} from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { PerkService } from '../perk-service';

describe.sequential('PerkService error path', () => {
  test('should fail to create perk with duplicate slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const slug = 'duplicate-slug-perk';
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const perkService = yield* PerkService;

            // Create first perk
            yield* perkService.createPerk({
              projectId: h.resources.project.id,
              name: 'First Perk',
              slug
            });

            // Try to create second perk with same slug
            const secondPerk = yield* perkService.createPerk({
              projectId: h.resources.project.id,
              name: 'Second Perk',
              slug
            });
            return secondPerk;
          }),
          Effect.provide(PerkService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PerkSlugAlreadyExistsError);

    t.onTestFinished(async () => {
      await h.db.primary.delete(perks).where(eq(perks.slug, slug));
    });
  });

  test('should fail to get perk by non-existent ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('perk');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const perkService = yield* PerkService;
            const perk = yield* perkService.getPerkById(nonExistentId);
            return perk;
          }),
          Effect.provide(PerkService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PerkNotFoundError);
  });

  test('should fail to delete non-existent perk', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('perk');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const perkService = yield* PerkService;
            yield* perkService.deletePerk({
              perkId: nonExistentId
            });
            return 'deleted';
          }),
          Effect.provide(PerkService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PerkNotFoundError);
  });
});
