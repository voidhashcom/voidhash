import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  ApiKeyNotFoundError,
  ApiKeyServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const ApiKey = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  end: Schema.String,
  key: Schema.String,
  prefix: Schema.String,
  isPublic: Schema.Boolean,
  projectId: Schema.String
});

export const ApiKeyWithRawKey = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  end: Schema.String,
  prefix: Schema.String,
  isPublic: Schema.Boolean,
  projectId: Schema.String,
  rawKey: Schema.String
});

export class ApiKeyRpcsDef extends RpcGroup.make(
  Rpc.make('CreateSecretKey', {
    success: ApiKeyWithRawKey,
    payload: {
      projectId: Schema.String,
      name: Schema.String
    },
    error: Schema.Union(ApiKeyServiceError, ActionForbiddenError)
  }),
  Rpc.make('ListApiKeys', {
    success: Schema.Array(ApiKey),
    payload: {
      projectId: Schema.String
    },
    error: Schema.Union(ApiKeyServiceError, ActionForbiddenError)
  }),
  Rpc.make('GetApiKeyById', {
    success: ApiKey,
    payload: {
      apiKeyId: Schema.String
    },
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    )
  }),
  Rpc.make('RotateSecretKey', {
    success: ApiKeyWithRawKey,
    payload: {
      apiKeyId: Schema.String
    },
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    )
  }),
  Rpc.make('DeleteApiKey', {
    success: Schema.Void,
    payload: {
      apiKeyId: Schema.String
    },
    error: Schema.Union(
      ApiKeyServiceError,
      ApiKeyNotFoundError,
      ActionForbiddenError
    )
  })
).middleware(AuthMiddleware) {}
