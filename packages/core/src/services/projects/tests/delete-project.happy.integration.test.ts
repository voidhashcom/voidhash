import { eq, type InsertProject, projects } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('deleteProject happy path', () => {
  test('should delete project successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();

    // Setup project
    const authSession = h.createAuthSession({ type: 'user' });

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;
            const dbService = yield* Db;

            const _createProjectRecord = dbService.makeQuery(
              (execute, project: InsertProject) =>
                execute(async (db) => {
                  await db.insert(projects).values(project);
                  return { id: project.id };
                })
            );

            // Create a test project to delete
            const testProjectId = generateId('test');
            yield* _createProjectRecord({
              id: testProjectId,
              name: 'Project To Delete',
              slug: 'project-to-delete',
              organizationId: h.resources.organization.id,
              createdByUserId: h.resources.user.id,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const updatedAuthSession = {
              ...authSession,
              projects: [
                ...authSession.projects,
                {
                  id: testProjectId,
                  slug: 'project-to-delete',
                  name: 'Project To Delete',
                  organizationId: h.resources.organization.id,
                  permissions: ['project:all']
                }
              ]
            };
            yield* projectService
              .deleteProject({
                id: testProjectId
              })
              .pipe(Effect.provideService(AuthSession, updatedAuthSession));

            return 'deleted';
          }),

          Effect.provide(ProjectService.Default),
          Effect.provideService(AuthSession, authSession)
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('deleted');
  });
});

