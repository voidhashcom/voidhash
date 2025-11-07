import { generateId } from '@voidhash/lib';
import { AuthSession, ProjectNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('deleteProject error path', () => {
  test('should fail to delete non-existent project', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('project');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;
            yield* projectService.deleteProject({
              id: nonExistentId
            });
            return 'deleted';
          }),
          Effect.provide(ProjectService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ProjectNotFoundError);
  });
});

