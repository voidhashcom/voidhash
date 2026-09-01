import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcApiKeyNotFoundError, RpcApiKeyServiceError } from "../errors/ApiKey.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const ApiKey = Schema.Struct({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
});
export type ApiKey = typeof ApiKey.Type;

export const ApiKeyWithRawKey = Schema.Struct({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
  rawKey: Schema.String,
});
export type ApiKeyWithRawKey = typeof ApiKeyWithRawKey.Type;

export const UserApiKey = Schema.Struct({
  createdAt: Schema.Date,
  enabled: Schema.NullOr(Schema.Boolean),
  end: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  prefix: Schema.NullOr(Schema.String),
});
export type UserApiKey = typeof UserApiKey.Type;

export const UserApiKeyWithRawKey = Schema.Struct({
  createdAt: Schema.Date,
  end: Schema.String,
  id: Schema.String,
  name: Schema.String,
  prefix: Schema.String,
  rawKey: Schema.String,
});
export type UserApiKeyWithRawKey = typeof UserApiKeyWithRawKey.Type;

export class ApiKeyRpcsDef extends RpcGroup.make(
  Rpc.make("CreateSecretKey", {
    error: Schema.Union([RpcApiKeyServiceError, RpcActionForbiddenError]),
    payload: {
      name: Schema.String,
      projectId: Schema.String,
    },
    success: ApiKeyWithRawKey,
  }),
  Rpc.make("ListApiKeys", {
    error: Schema.Union([RpcApiKeyServiceError, RpcActionForbiddenError]),
    payload: {
      projectId: Schema.String,
    },
    success: Schema.Array(ApiKey),
  }),
  Rpc.make("GetApiKeyById", {
    error: Schema.Union([RpcApiKeyServiceError, RpcApiKeyNotFoundError, RpcActionForbiddenError]),
    payload: {
      apiKeyId: Schema.String,
    },
    success: ApiKey,
  }),
  Rpc.make("RotateSecretKey", {
    error: Schema.Union([RpcApiKeyServiceError, RpcApiKeyNotFoundError, RpcActionForbiddenError]),
    payload: {
      apiKeyId: Schema.String,
    },
    success: ApiKeyWithRawKey,
  }),
  Rpc.make("DeleteApiKey", {
    error: Schema.Union([RpcApiKeyServiceError, RpcApiKeyNotFoundError, RpcActionForbiddenError]),
    payload: {
      apiKeyId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("CreateUserApiKey", {
    error: Schema.Union([RpcApiKeyServiceError]),
    payload: {
      name: Schema.String,
      prefix: Schema.String,
    },
    success: UserApiKeyWithRawKey,
  }),
  Rpc.make("ListUserApiKeys", {
    error: Schema.Union([RpcApiKeyServiceError]),
    payload: {},
    success: Schema.Array(UserApiKey),
  }),
  Rpc.make("RevokeUserApiKey", {
    error: Schema.Union([RpcApiKeyServiceError, RpcApiKeyNotFoundError]),
    payload: {
      userApiKeyId: Schema.String,
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
