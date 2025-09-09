import {
  type ApiKey,
  apiKeys,
  asc,
  desc,
  eq,
  type InsertApiKey
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';

export class ApiKeyRepository extends Effect.Service<ApiKeyRepository>()(
  'ApiKeyRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createApiKey: dbService.makeQuery((execute, apiKey: InsertApiKey) =>
          execute(async (db) => {
            await db.insert(apiKeys).values(apiKey);
            return { id: apiKey.id };
          })
        ),

        getApiKeyById: dbService.makeQuery((execute, id: string) =>
          execute(
            async (db) =>
              await db.query.apiKeys.findFirst({
                where: eq(apiKeys.id, id)
              })
          )
        ),

        getApiKeys: dbService.makeQuery((execute, projectId: string) =>
          execute(
            async (db) =>
              await db.query.apiKeys.findMany({
                where: eq(apiKeys.projectId, projectId),
                orderBy: [desc(apiKeys.isPublic), asc(apiKeys.createdAt)]
              })
          )
        ),

        updateApiKey: dbService.makeQuery(
          (execute, apiKey: Omit<Partial<ApiKey>, 'id'> & { id: string }) =>
            execute(async (db) => {
              await db
                .update(apiKeys)
                .set(apiKey)
                .where(eq(apiKeys.id, apiKey.id));
              return { id: apiKey.id };
            })
        ),

        deleteApiKey: dbService.makeQuery((execute, id: string) =>
          execute(async (db) => {
            await db.delete(apiKeys).where(eq(apiKeys.id, id));
            return { id };
          })
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
