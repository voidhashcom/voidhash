import { HttpApiError } from '@effect/platform';
import { Effect } from 'effect';

export const HandleCommonErrors = {
  DatabaseError: () => Effect.fail(new HttpApiError.InternalServerError())
} as const;

export const HandleSecretKeyAuthErrors = {
  MissingSecretKeyError: () => Effect.fail(new HttpApiError.Unauthorized()),
  InvalidSecretKeyError: () => Effect.fail(new HttpApiError.Unauthorized())
} as const;

export const HandlePublishableKeyAuthErrors = {
  MissingPublishableKeyError: () =>
    Effect.fail(new HttpApiError.Unauthorized()),
  InvalidPublishableKeyError: () =>
    Effect.fail(new HttpApiError.Unauthorized()),
  MissingAppUserIdError: () => Effect.fail(new HttpApiError.BadRequest())
} as const;
