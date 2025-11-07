import { eq, projects } from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('createProject happy path', () => {
  test('should create a project successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      name: 'Test Project',
      organizationId: h.resources.organization.id
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;
            const project = yield* projectService.createProject(input);
            return project;
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
      id: expect.any(String),
      name: 'Test Project',
      slug: expect.any(String)
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(projects).where(eq(projects.id, value.id));
      }
    });
  });
});

