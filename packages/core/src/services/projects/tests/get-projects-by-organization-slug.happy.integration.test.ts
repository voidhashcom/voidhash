import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('getProjectsByOrganizationSlug happy path', () => {
  test('should get projects by organization slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;

            const projectsList =
              yield* projectService.getProjectsByOrganizationSlug(
                h.resources.organization.slug as string
              );
            return projectsList;
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

    expect(value).toBeDefined();
    expect(Array.isArray(value)).toBe(true);
    const testProject = value?.find((p) => p.id === h.resources.project.id);
    expect(testProject).toMatchObject({
      id: h.resources.project.id,
      name: h.resources.project.name,
      slug: h.resources.project.slug
    });
  });
});
