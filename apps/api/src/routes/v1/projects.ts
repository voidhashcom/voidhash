import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { ProjectService } from '@voidhash/core/services';
import { Effect } from 'effect';

export const ProjectsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'projects',
  (handlers) =>
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      return handlers
        .handle('createProject', ({ payload }) =>
          Effect.gen(function* () {
            return yield* projectService.createProject({
              name: payload.name,
              organizationId: payload.organizationId
            });
          })
        )
        .handle('listProjects', ({ path: { organizationId } }) =>
          projectService.getProjects(organizationId)
        );
    })
);
