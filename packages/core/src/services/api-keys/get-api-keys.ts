import { apiKeys, asc, desc, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { ApiKeyServiceError, AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getApiKeys = (db: Db) =>
  db.makeQuery((execute, projectId: string) =>
    execute(
      async (db) =>
        await db.query.apiKeys.findMany({
          orderBy: [desc(apiKeys.isPublic), asc(apiKeys.createdAt)],
          where: eq(apiKeys.projectId, projectId),
        })
    )
  );

export const getApiKeys = Effect.gen(function* getApiKeys() {
  const db = yield* Db;
  return Effect.fn("getApiKeys")(
    function* getApiKeys(projectId: string) {
      const session = yield* AuthSession;
      // SECURITY: Authorization check
      yield* checkProjectPermission(
        projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to access api keys for project ${projectId}`
      );
      return yield* _getApiKeys(db)(projectId);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (e) =>
            new ApiKeyServiceError({ cause: String(e.cause) }),
        })
      )
  );
});
