import { eq, type InsertPerk, perks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PerkService } from '../index';

describe.sequential('getPerkById happy path', () => {
  test('should get perk by ID', async (t) => {
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
              name: 'Test Perk By ID',
              slug: 'test-perk-by-id',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const perk = yield* perkService.getPerkById(testPerkId);
            return { perk, testPerkId };
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

    expect(value.perk).toMatchObject({
      id: value.testPerkId,
      name: 'Test Perk By ID',
      slug: 'test-perk-by-id',
      projectId: h.resources.project.id
    });

    t.onTestFinished(async () => {
      await h.db.primary.delete(perks).where(eq(perks.id, value.testPerkId));
    });
  });
});

