import { changesetDeployments, eq, perks } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import { AuthSession, ChangesetDeploymentServiceError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ChangesetDeploymentService } from '../index';

describe.sequential('deployChangeset error path', () => {
  test('should fail to deploy changeset with duplicate perk slug', async (t) => {
    const h = await IntegrationHarness.init(t);
    const slug = 'duplicate-perk-slug-deployment';

    t.onTestFinished(async () => {
      // Clean up the existing perk
      await h.db.primary.delete(perks).where(eq(perks.slug, slug));
      // Clean up any deployment records that might have been created
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
    const changeset = {
      changes: [
        {
          changeType: 'create-perk' as const,
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

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ChangesetDeploymentServiceError);
  });
});
