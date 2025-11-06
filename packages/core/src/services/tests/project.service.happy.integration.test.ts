import { eq, type InsertProject, projects } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { ProjectService } from '../projects';

describe.sequential('ProjectService happy path', () => {
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

  test('should get project by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;

            const project = yield* projectService.getProjectById(
              h.resources.project.id
            );
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
      id: h.resources.project.id,
      name: h.resources.project.name,
      slug: h.resources.project.slug,
      organizationId: h.resources.project.organizationId
    });
  });

  test('should get project by slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;

            const project = yield* projectService.getProjectBySlug({
              organizationId: h.resources.organization.id,
              slug: h.resources.project.slug
            });
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
      id: h.resources.project.id,
      name: h.resources.project.name,
      slug: h.resources.project.slug,
      organizationId: h.resources.project.organizationId
    });
  });

  test('should get project by slug and organization slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;

            const project =
              yield* projectService.getProjectBySlugAndOrganizationSlug({
                organizationSlug: h.resources.organization.slug as string,
                projectSlug: h.resources.project.slug
              });
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
      id: h.resources.project.id,
      name: h.resources.project.name,
      slug: h.resources.project.slug,
      organizationId: h.resources.project.organizationId
    });
  });

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
