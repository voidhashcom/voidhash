import { Data, Effect } from 'effect';
import { ApiClient } from '../api-client';
import { readConfig } from '../config/read-config';

export class NoSignedInUserError extends Data.TaggedError(
  'NoSignedInUserError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class FailedToGetSessionError extends Data.TaggedError(
  'FailedToGetSessionError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

/**
 * Retrieves the currently signed-in user from the local configuration and the BetterAuth service.
 *
 * Attempts to read the API key from the user's config file. If no API key is found, or if the session
 * cannot be retrieved or does not contain a user, a `NoSignedInUserError` is thrown.
 * If the session retrieval fails for other reasons, a `FailedToGetSessionError` is thrown.
 *
 * @returns {Effect.Effect<unknown, NoSignedInUserError | FailedToGetSessionError, { name: string; email: string }>}
 *   An Effect that yields the signed-in user's information, or fails with an appropriate error.
 */
export const getSignedInSession = Effect.gen(function* () {
  const client = yield* ApiClient;

  const config = yield* readConfig().pipe(
    Effect.catchTag('ConfigFileNotFoundError', () => Effect.succeed(null)),
    Effect.catchAll(() => Effect.dieMessage('Failed to read config'))
  );

  // If the config file is not found or the api key is not set, we consider the user to be signed out
  const apiKey = config?.apiKey;
  if (!apiKey) {
    yield* Effect.logInfo(
      'Api key is not set, considering the user to be signed out'
    );
    return yield* Effect.fail(
      new NoSignedInUserError({ message: 'No signed in user' })
    );
  }

  const sessionResponse = yield* client.v1_auth.session({
    headers: {
      'x-api-key': apiKey
    }
  });

  return sessionResponse;
});
