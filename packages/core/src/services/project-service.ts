import {
  and,
  apiKeys,
  eq,
  type InsertApiKey,
  type InsertProject,
  organization,
  projects
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import {
  createShortId,
  createSlug,
  generateId,
  SLUG_BLACKLIST
} from '@voidhash/lib';
import {
  AuthenticationError,
  AuthSession,
  ProjectNotFoundError,
  ProjectServiceError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';

import { createPublishableKey } from '../utils/api-keys/effect/utils';
import {
  checkOrganizationPermission,
  checkProjectPermission
} from '../utils/permissions';

export class ProjectService extends Effect.Service<ProjectService>()(
  'ProjectService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _createApiKeyRecord = dbService.makeQuery(
        (execute, apiKey: InsertApiKey) =>
          execute(async (db) => {
            await db.insert(apiKeys).values(apiKey);
            return { id: apiKey.id };
          })
      );

      const _getOrganizationBySlug = dbService.makeQuery(
        (execute, slug: string) =>
          execute(
            async (db) =>
              await db.query.organization.findFirst({
                where: eq(organization.slug, slug)
              })
          )
      );

      const _getProjectBySlug = dbService.makeQuery(
        (
          execute,
          {
            projectSlug,
            organizationId
          }: { projectSlug: string; organizationId: string }
        ) =>
          execute(
            async (db) =>
              await db.query.projects.findFirst({
                where: and(
                  eq(projects.slug, projectSlug),
                  eq(projects.organizationId, organizationId)
                )
              })
          )
      );

      const _createProjectRecord = dbService.makeQuery(
        (execute, project: InsertProject) =>
          execute(async (db) => await db.insert(projects).values(project))
      );

      const createProject = (input: { name: string; organizationId: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              input.organizationId,
              'organization:all',
              `User ${session?.user?.id} is not authorized to create projects for organization ${input.organizationId}`
            );

            const userId = session?.user?.id;
            if (!userId) {
              return yield* Effect.fail(
                new AuthenticationError({
                  message: 'You are not authenticated',
                  cause: 'You are not authenticated'
                })
              );
            }

            const id = generateId('project');
            let slug = createSlug(input.name);

            if (SLUG_BLACKLIST.includes(slug)) {
              slug = `${slug}-${createShortId()}`;
            }

            const existingProject = yield* _getProjectBySlug({
              projectSlug: slug,
              organizationId: input.organizationId
            });

            if (existingProject) {
              slug = `${slug}-${createShortId()}`;
            }

            yield* dbService.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  yield* _createProjectRecord({
                    id,
                    name: input.name,
                    slug,
                    organizationId: input.organizationId,
                    createdByUserId: userId
                  });

                  // Create production publishable key
                  const productionPublishableKey =
                    yield* createPublishableKey();
                  yield* _createApiKeyRecord({
                    id: generateId('apiPublishableKey'),
                    projectId: id,
                    name: 'Publishable key',
                    ...productionPublishableKey
                  });
                })
              )
            );

            yield* Effect.log(
              `Created project ${id} for organization ${input.organizationId}`
            );

            return yield* Effect.succeed({
              id,
              name: input.name,
              slug
            });
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getProjectsByOrganizationId = dbService.makeQuery(
        (execute, organizationId: string) =>
          execute(
            async (db) =>
              await db.query.projects.findMany({
                where: eq(projects.organizationId, organizationId)
              })
          )
      );

      const getProjects = (organizationId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              organizationId,
              'organization:all',
              `User ${session?.user?.id} is not authorized to access projects for organization ${organizationId}`
            );

            return yield* _getProjectsByOrganizationId(organizationId);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getProjectById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.projects.findFirst({
              where: eq(projects.id, id)
            })
        )
      );

      const getProjectById = (id: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const project = yield* _getProjectById(id);
            if (!project) {
              return null;
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              id,
              'project:all',
              `User ${session?.user?.id} is not authorized to access project ${id}`
            );

            return project;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const getProjectBySlug = ({
        organizationId,
        slug
      }: {
        organizationId: string;
        slug: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const project = yield* _getProjectBySlug({
              projectSlug: slug,
              organizationId
            });

            if (!project) {
              return null;
            }

            // SECURITY: Authorization check for project
            yield* checkProjectPermission(
              project.id,
              'project:all',
              `User ${session?.user?.id} is not authorized to access project ${project.id}`
            );

            return project;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const getProjectBySlugAndOrganizationSlug = ({
        organizationSlug,
        projectSlug
      }: {
        organizationSlug: string;
        projectSlug: string;
      }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const organization =
              yield* _getOrganizationBySlug(organizationSlug);
            if (!organization) {
              return null;
            }

            const project = yield* _getProjectBySlug({
              projectSlug,
              organizationId: organization.id
            });

            if (!project) {
              return null;
            }

            // SECURITY: Authorization check for project
            yield* checkProjectPermission(
              project.id,
              'project:all',
              `User ${session?.user?.id} is not authorized to access project ${project.id}`
            );

            return project;
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const getProjectsByOrganizationSlug = (organizationSlug: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const organization =
              yield* _getOrganizationBySlug(organizationSlug);
            if (!organization) {
              return null;
            }

            // SECURITY: Authorization check for organization
            yield* checkOrganizationPermission(
              organization.id,
              'organization:all',
              `User ${session?.user?.id} is not authorized to access organization ${organization.id}`
            );

            return yield* _getProjectsByOrganizationId(organization.id);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _updateProjectRecord = dbService.makeQuery(
        (execute, { id, name }: { id: string; name: string }) =>
          execute(
            async (db) =>
              await db.update(projects).set({ name }).where(eq(projects.id, id))
          )
      );

      const updateProject = (input: { id: string; name: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // First check if project exists
            const project = yield* _getProjectById(input.id);
            if (!project) {
              return yield* Effect.fail(
                new ProjectNotFoundError({
                  projectId: input.id
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.id,
              'project:all',
              `User ${session?.user?.id} is not authorized to update project ${input.id}`
            );

            // Update the project
            yield* _updateProjectRecord({
              id: input.id,
              name: input.name
            });

            yield* Effect.log(`Updated project ${input.id}`);

            return yield* Effect.succeed(undefined);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _deleteProjectRecord = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) => await db.delete(projects).where(eq(projects.id, id))
        )
      );

      const deleteProject = (input: { id: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // First check if project exists
            const project = yield* _getProjectById(input.id);
            if (!project) {
              return yield* Effect.fail(
                new ProjectNotFoundError({
                  projectId: input.id
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.id,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete project ${input.id}`
            );

            // Delete the project
            yield* _deleteProjectRecord(input.id);

            yield* Effect.log(`Deleted project ${input.id}`);

            return yield* Effect.succeed(undefined);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new ProjectServiceError({
                cause: String(error.cause)
              })
          })
        );

      return {
        createProject,
        getProjects,
        getProjectById,
        getProjectBySlug,
        getProjectBySlugAndOrganizationSlug,
        getProjectsByOrganizationSlug,
        updateProject,
        deleteProject
      } as const;
    })
  }
) {}
