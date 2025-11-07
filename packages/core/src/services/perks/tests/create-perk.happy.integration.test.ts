import { eq, perks } from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PerkService } from '../index';

describe.sequential('createPerk happy path', () => {
  test('should create a perk successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      name: 'Test Perk',
      slug: 'test-perk'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const perkService = yield* PerkService;
            const perk = yield* perkService.createPerk(input);
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });
    expect(value).toMatchObject({
      id: expect.any(String)
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(perks).where(eq(perks.id, value.id));
      }
    });
  });
});

