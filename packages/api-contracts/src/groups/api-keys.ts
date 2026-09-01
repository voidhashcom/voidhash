import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiApiKeyNotFoundError,
  ApiApiKeyServiceError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { ApiKeyListParams } from "../schemas/tenancy.ts";
import { ApiKey, ApiKeyWithRawKey, CreateSecretKeyBody } from "../Schema.ts";

export const ApiKeysGroup = HttpApiGroup.make("api_keys")
  .add(
    HttpApiEndpoint.post("createSecretKey", "/", {
      success: ApiKeyWithRawKey,
      payload: CreateSecretKeyBody,
      error: [ApiApiKeyServiceError, ApiActionForbiddenError],
    }),
  )
  /**
   * Lists the API keys of a single project. `projectId` may be omitted when the
   * credential resolves to exactly one project, which is always the case for a
   * secret key.
   *
   * Credential: user, secret-key.
   */
  .add(
    HttpApiEndpoint.get("listApiKeys", "/", {
      query: ApiKeyListParams,
      success: paginated(ApiKey),
      error: [ApiApiKeyServiceError, ApiActionForbiddenError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getApiKeyById", "/:apiKeyId", {
      params: { apiKeyId: Schema.String },
      success: ApiKey,
      error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
    }),
  )
  .add(
    HttpApiEndpoint.post("rotateSecretKey", "/:apiKeyId/rotate", {
      params: { apiKeyId: Schema.String },
      success: ApiKeyWithRawKey,
      error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
    }),
  )
  .add(
    HttpApiEndpoint.delete("deleteApiKey", "/:apiKeyId", {
      params: { apiKeyId: Schema.String },
      error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/api-keys");
