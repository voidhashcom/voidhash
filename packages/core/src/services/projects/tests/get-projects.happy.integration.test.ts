import { eq, type InsertProject, projects } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ProjectService } from '../index';

describe.sequential('getProjects happy path', () => {
  test('should get projects for an organization', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
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

            // Create a test project
            const testProjectId = generateId('project');
            yield* _createProjectRecord({
              id: testProjectId,
              name: 'Test Project',
              slug: 'test-project',
              organizationId: h.resources.organization.id,
              createdByUserId: h.resources.user.id,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Create a test project for different organization
            const testProjectDifferentOrgId = generateId('project');
            yield* _createProjectRecord({
              id: testProjectDifferentOrgId,
              name: 'Test Project Different Org',
              slug: 'test-project-different-org',
              organizationId: generateId('test'),
              createdByUserId: h.resources.user.id,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const projectsList = yield* projectService.getProjects(
              h.resources.organization.id
            );

            return { projectsList, testProjectId, testProjectDifferentOrgId };
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

    expect(value.projectsList.length).toBeGreaterThan(0);
    const testProject = value.projectsList.find(
      (p) => p.id === value.testProjectId
    );
    expect(testProject).toMatchObject({
      organizationId: h.resources.organization.id,
      name: 'Test Project',
      slug: 'test-project'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(projects)
        .where(eq(projects.id, value.testProjectId));
      await h.db.primary
        .delete(projects)
        .where(eq(projects.id, value.testProjectDifferentOrgId));
    });
  });
});
