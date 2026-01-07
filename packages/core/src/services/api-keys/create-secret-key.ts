import { type InsertApiKey, apiKeys, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import { ApiKeyServiceError, AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

import { createSecretKey as generateSecretKeyFn } from "../../utils/api-keys/effect/utils";
import { checkProjectPermission } from "../../utils/permissions";

const _createApiKeyRecord = (db: Db) =>
  db.makeQuery((execute, apiKey: InsertApiKey) =>
    execute(async (db) => {
      await db.insert(apiKeys).values(apiKey);
      return { id: apiKey.id };
    })
  );

const _getApiKeyById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, id) })
    )
  );

export const createSecretKey = Effect.gen(function* createSecretKey() {
  const db = yield* Db;
  return Effect.fn("createSecretKey")(
    function* createSecretKey(input: { projectId: string; name: string }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to create secret keys for project ${input.projectId}`
      );

      const { rawKey, ...secretKey } = yield* generateSecretKeyFn();

      const apiKeyId = generateId("apiSecretKey");
      yield* _createApiKeyRecord(db)({
        id: apiKeyId,
        projectId: input.projectId,
        name: input.name,
        ...secretKey,
      });

      const apiKey = yield* _getApiKeyById(db)(apiKeyId);
      if (!apiKey) {
        return yield* Effect.fail(
          new ApiKeyServiceError({
            cause: "API key not found after creation.",
          })
        );
      }

      return {
        ...apiKey,
        rawKey,
      };
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
