import { apiKeys, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthSession,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getApiKeyById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.apiKeys.findFirst({
          where: eq(apiKeys.id, id),
        })
    )
  );

const _deleteApiKeyRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => {
      await db.delete(apiKeys).where(eq(apiKeys.id, id));
      return { id };
    })
  );

export const deleteSecretKey = Effect.gen(function* deleteSecretKey() {
  const db = yield* Db;
  return Effect.fn("deleteSecretKey")(
    function* deleteSecretKey(input: { secretKeyId: string }) {
      const session = yield* AuthSession;

      const existingKey = yield* _getApiKeyById(db)(input.secretKeyId);
      if (!existingKey) {
        return yield* Effect.fail(
          new ApiKeyNotFoundError({
            message: "Secret key not found",
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        existingKey.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to delete secret key ${input.secretKeyId} for project ${existingKey.projectId}`
      );

      yield* _deleteApiKeyRecord(db)(input.secretKeyId);
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
