import { type ApiKey as DbApiKey, apiKeys, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthSession,
} from "@voidhash/shared";
import { Effect } from "effect";

import { createSecretKey as generateSecretKeyFn } from "../../utils/api-keys/effect/utils";
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

const _updateApiKeyRecord = (db: Db) =>
  db.makeQuery(
    (execute, apiKey: Omit<Partial<DbApiKey>, "id"> & { id: string }) =>
      execute(async (db) => {
        await db.update(apiKeys).set(apiKey).where(eq(apiKeys.id, apiKey.id));
        return { id: apiKey.id };
      })
  );

export const rotateSecretKey = Effect.gen(function* rotateSecretKey() {
  const db = yield* Db;
  return Effect.fn("rotateSecretKey")(
    function* rotateSecretKey(input: { secretKeyId: string }) {
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
        `User ${session?.user?.id} is not authorized to rotate secret key ${input.secretKeyId} for project ${existingKey.projectId}`
      );

      const { rawKey, ...newKey } = yield* generateSecretKeyFn();
      yield* _updateApiKeyRecord(db)({
        id: input.secretKeyId,
        ...newKey,
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      return {
        ...existingKey,
        ...newKey,
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
