import {
  HttpApiBuilder,
  HttpApiError,
  HttpServerResponse
} from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';
import {
  authenticateWithApiKey,
  OrganizationService
} from '@voidhash/core/services';
import { Effect, pipe } from 'effect';
import { getApiKeyFromRequest } from '@/utils/auth';
import { HandleCommonErrors } from '@/utils/errors';

export const OrganizationsGroupLive = HttpApiBuilder.group(
  VoidhashApi,
  'v1_organizations',
  (handlers) =>
    Effect.gen(function* () {
      return handlers.handle('createOrganization', ({ payload }) =>
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          const apiKey = yield* getApiKeyFromRequest().pipe(
            Effect.orElse(() => Effect.succeed(null))
          );

          if (apiKey) {
            return yield* authenticateWithApiKey(apiKey)(
              Effect.gen(function* () {
                const organization =
                  yield* organizationService.createOrganization({
                    name: payload.name
                  });

                return yield* HttpServerResponse.json({
                  id: organization.id,
                  name: organization.name,
                  slug: organization.slug
                });
              })
            );
          }
          return yield* Effect.fail(new HttpApiError.Unauthorized());
        }).pipe(
          Effect.catchTags({
            BetterAuthError: (e) =>
              pipe(
                Effect.fail(new HttpApiError.InternalServerError()),
                Effect.tapError(() => Effect.logError(e))
              ),
            HttpBodyError: (e) =>
              pipe(
                Effect.fail(new HttpApiError.InternalServerError()),
                Effect.tapError(() => Effect.logError(e))
              )
          }),
          Effect.catchTags(HandleCommonErrors)
        )
      );
    })
);
