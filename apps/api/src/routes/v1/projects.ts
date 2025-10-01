import {
  HttpApiBuilder,
  HttpApiError,
  HttpServerResponse
} from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';
import {
  authenticateWithApiKey,
  ProjectService
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { getApiKeyFromRequest } from '@/utils/auth';
import { HandleCommonErrors } from '@/utils/errors';

export const ProjectsGroupLive = HttpApiBuilder.group(
  VoidhashApi,
  'v1_projects',
  (handlers) =>
    Effect.gen(function* () {
      return handlers.handle('createProject', ({ payload }) =>
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const apiKey = yield* getApiKeyFromRequest().pipe(
            Effect.orElse(() => Effect.succeed(null))
          );

          if (apiKey) {
            return yield* authenticateWithApiKey(apiKey)(
              Effect.gen(function* () {
                const project = yield* projectService.createProject({
                  name: payload.name,
                  organizationId: payload.organizationId
                });

                return yield* HttpServerResponse.json({
                  id: project.id,
                  name: project.name,
                  slug: project.slug
                });
              })
            );
          }
          return yield* Effect.fail(new HttpApiError.Unauthorized());
        }).pipe(
          Effect.catchTags({
            BetterAuthError: () =>
              Effect.fail(new HttpApiError.InternalServerError()),
            HttpBodyError: () =>
              Effect.fail(new HttpApiError.InternalServerError())
          }),
          Effect.catchTags(HandleCommonErrors)
        )
      );
    })
);
