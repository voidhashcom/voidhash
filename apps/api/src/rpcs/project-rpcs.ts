import { ProjectService } from '@voidhash/core/services';
import { ProjectRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const ProjectRpcsLive = ProjectRpcsDef.toLayer(
  Effect.gen(function* () {
    const projectService = yield* ProjectService;
    return {
      CreateProject: ({ name, organizationId }) =>
        projectService.createProject({ name, organizationId }),
      ListProjects: ({ organizationId }) =>
        projectService.getProjects(organizationId),
      UpdateProject: ({ id, name }) =>
        projectService.updateProject({ id, name }),
      DeleteProject: ({ id }) => projectService.deleteProject({ id })
    };
  })
).pipe(Layer.provide(ProjectService.Default));
