import {
  ChangesetDeploymentStatus,
  changesetDeployments,
  eq,
  perks
} from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ChangesetDeploymentService } from '../index';

describe.sequential('deployChangeset happy path', () => {
  test('should deploy a changeset successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const changeset = {
      changes: [
        {
          changeType: 'create-perk' as const,
          key: 'test-perk-1',
          payload: {
            slug: 'test-perk-deployment',
            name: 'Test Perk Deployment'
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
        return yield* pipe(
          Effect.gen(function* () {
            const changesetDeploymentService =
              yield* ChangesetDeploymentService;
            const deployment =
              yield* changesetDeploymentService.deployChangeset(input);
            return deployment;
          }),
          Effect.provide(ChangesetDeploymentService.Default),
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
    expect(value.id).toContain('chd_');

    // Verify the deployment record was created
    const deploymentRecord = await h.db.primary
      .select()
      .from(changesetDeployments)
      .where(eq(changesetDeployments.id, value.id))
      .limit(1);

    expect(deploymentRecord).toHaveLength(1);
    expect(deploymentRecord[0]).toMatchObject({
      id: value.id,
      projectId: h.resources.project.id,
      status: ChangesetDeploymentStatus.Pending,
      changeset
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary
          .delete(changesetDeployments)
          .where(eq(changesetDeployments.id, value.id));
      }
      // Clean up the created perk if it exists
      await h.db.primary
        .delete(perks)
        .where(eq(perks.slug, 'test-perk-deployment'))
        .catch(() => {
          // Ignore errors if perk doesn't exist
        });
    });
  });
});
