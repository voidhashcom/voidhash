import { eq, type InsertPerk, perks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PerkService } from '../index';

describe.sequential('getPerks happy path', () => {
  test('should get perks for a project', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const perkService = yield* PerkService;
            const dbService = yield* Db;

            const _createPerkRecord = dbService.makeQuery(
              (execute, perk: InsertPerk) =>
                execute(async (db) => {
                  await db.insert(perks).values(perk);
                  return { id: perk.id };
                })
            );

            // Create a test perk
            const testPerkId = generateId('perk');
            yield* _createPerkRecord({
              id: testPerkId,
              projectId: h.resources.project.id,
              name: 'Test Perk',
              slug: 'test-perk',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Create a test perk for different project
            const testPerkDifferentProjectId = generateId('perk');
            yield* _createPerkRecord({
              id: testPerkDifferentProjectId,
              projectId: generateId('test'),
              name: 'Test Perk Different Project',
              slug: 'test-perk-different-project',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const perksList = yield* perkService.getPerks(
              h.resources.project.id
            );

            return { perksList, testPerkId, testPerkDifferentProjectId };
          }),
          Effect.provide(PerkService.Default),
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

    expect(value.perksList.length).toBeGreaterThan(0);
    const testPerk = value.perksList.find((p) => p.id === value.testPerkId);
    expect(testPerk).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Perk',
      slug: 'test-perk'
    });

    t.onTestFinished(async () => {
      await h.db.primary.delete(perks).where(eq(perks.id, value.testPerkId));
      await h.db.primary
        .delete(perks)
        .where(eq(perks.id, value.testPerkDifferentProjectId));
    });
  });
});
