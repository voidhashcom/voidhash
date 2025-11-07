import { apiKeys, eq } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthSession
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _getApiKeyById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.apiKeys.findFirst({
          where: eq(apiKeys.id, id)
        })
    )
  );

export const getApiKeyById = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('getApiKeyById')(
    function* (id: string) {
      const session = yield* AuthSession;

      const apiKey = yield* _getApiKeyById(db)(id);
      if (!apiKey) {
        return yield* Effect.fail(
          new ApiKeyNotFoundError({
            message: 'API key not found'
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        apiKey.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to access api key ${id} for project ${apiKey.projectId}`
      );

      return apiKey;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (e) =>
            new ApiKeyServiceError({ cause: String(e.cause) })
        })
      )
  );
});
