import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  ApiKeyNotFoundError,
  ApiKeyServiceError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const ApiKey = Schema.Struct({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
});

export const ApiKeyWithRawKey = Schema.Struct({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
  rawKey: Schema.String,
});

export class ApiKeyRpcsDef extends RpcGroup.make(
  Rpc.make("CreateSecretKey", {
    error: Schema.Union(ApiKeyServiceError, ActionForbiddenError),
    payload: {
      name: Schema.String,
      projectId: Schema.String,
    },
    success: ApiKeyWithRawKey,
  }),
  Rpc.make("ListApiKeys", {
    error: Schema.Union(ApiKeyServiceError, ActionForbiddenError),
    payload: {
      projectId: Schema.String,
    },
    success: Schema.Array(ApiKey),
  }),
  Rpc.make("GetApiKeyById", {
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    ),
    payload: {
      apiKeyId: Schema.String,
    },
    success: ApiKey,
  }),
  Rpc.make("RotateSecretKey", {
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    ),
    payload: {
      apiKeyId: Schema.String,
    },
    success: ApiKeyWithRawKey,
  }),
  Rpc.make("DeleteApiKey", {
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    ),
    payload: {
      apiKeyId: Schema.String,
    },
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
