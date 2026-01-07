import { Effect } from "effect";

import { createSecretKey } from "./create-secret-key";
import { deleteSecretKey } from "./delete-secret-key";
import { getApiKeyById } from "./get-api-key-by-id";
import { getApiKeys } from "./get-api-keys";
import { rotateSecretKey } from "./rotate-secret-key";

export class ApiKeyService extends Effect.Service<ApiKeyService>()(
  "ApiKeyService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createSecretKey: yield* createSecretKey,
        deleteSecretKey: yield* deleteSecretKey,
        getApiKeyById: yield* getApiKeyById,
        getApiKeys: yield* getApiKeys,
        rotateSecretKey: yield* rotateSecretKey,
      };
    }),
  }
) {}
