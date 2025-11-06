import {
  and,
  apiKeys,
  eq,
  type InsertApiKey,
  type InsertProject,
  organization,
  projects
} from '@voidhash/db';
import type { Db } from '@voidhash/db/effect';

export const _createApiKeyRecord = (db: Db) =>
  db.makeQuery((execute, apiKey: InsertApiKey) =>
    execute(async (db) => {
      await db.insert(apiKeys).values(apiKey);
      return { id: apiKey.id };
    })
  );

export const _createProjectRecord = (db: Db) =>
  db.makeQuery((execute, project: InsertProject) =>
    execute(async (db) => await db.insert(projects).values(project))
  );

export const _getOrganizationBySlug = (db: Db) =>
  db.makeQuery((execute, slug: string) =>
    execute(
      async (db) =>
        await db.query.organization.findFirst({
          where: eq(organization.slug, slug)
        })
    )
  );

export const _getProjectBySlug = (db: Db) =>
  db.makeQuery(
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

export const _getProjectById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.projects.findFirst({
          where: eq(projects.id, id)
        })
    )
  );

export const _getProjectsByOrganizationId = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(
      async (db) =>
        await db.query.projects.findMany({
          where: eq(projects.organizationId, organizationId)
        })
    )
  );

export const _updateProjectRecord = (db: Db) =>
  db.makeQuery((execute, { id, name }: { id: string; name: string }) =>
    execute(
      async (db) =>
        await db.update(projects).set({ name }).where(eq(projects.id, id))
    )
  );

export const _deleteProjectRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => await db.delete(projects).where(eq(projects.id, id)))
  );
