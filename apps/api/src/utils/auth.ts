import { HttpServerRequest } from '@effect/platform';
import { Data, Effect } from 'effect';

export class MissingApiKeyError extends Data.TaggedError('MissingApiKeyError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingSecretKeyError extends Data.TaggedError(
  'MissingSecretKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingPublishableKeyError extends Data.TaggedError(
  'MissingPublishableKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingAppUserIdError extends Data.TaggedError(
  'MissingAppUserIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export const getSecretKeyFromRequest = () =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const headers = req.headers;
    const secretKey = headers['x-secret-key'];
    if (!secretKey) {
      return yield* Effect.fail(
        new MissingSecretKeyError({
          message: 'Missing secret key'
        })
      );
    }
    return secretKey;
  });

export const getApiKeyFromRequest = () =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const headers = req.headers;
    const apiKey = headers['x-api-key'];
    if (!apiKey) {
      return yield* Effect.fail(
        new MissingApiKeyError({ message: 'Missing api key' })
      );
    }
    return apiKey;
  });

export const getPublishableKeyFromRequest = () =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const headers = req.headers;
    const publishableKey = headers['x-publishable-key'];
    if (!publishableKey) {
      return yield* Effect.fail(
        new MissingPublishableKeyError({
          message: 'Missing publishable key'
        })
      );
    }
    return publishableKey;
  });

export const getAppUserIdFromRequest = () =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const headers = req.headers;
    const appUserId = headers['x-app-user-id'];
    if (!appUserId) {
      return yield* Effect.fail(
        new MissingAppUserIdError({
          message: 'Missing app user id'
        })
      );
    }
    return appUserId ?? null;
  });
