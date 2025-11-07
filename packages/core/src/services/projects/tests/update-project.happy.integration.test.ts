import { eq, projects } from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('updateProject happy path', () => {
  test('should update project successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;

            yield* projectService.updateProject({
              id: h.resources.project.id,
              name: 'Updated Project Name'
            });

            const updatedProject = yield* projectService.getProjectById(
              h.resources.project.id
            );
            return updatedProject;
          }),
          Effect.provide(ProjectService.Default),
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
      id: h.resources.project.id,
      name: 'Updated Project Name'
    });

    // Restore original name
    t.onTestFinished(async () => {
      await h.db.primary
        .update(projects)
        .set({ name: h.resources.project.name })
        .where(eq(projects.id, h.resources.project.id));
    });
  });
});

