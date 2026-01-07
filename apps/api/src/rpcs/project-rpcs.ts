import { ProjectService } from "@voidhash/core/services";
import { ProjectRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const ProjectRpcsLive = ProjectRpcsDef.toLayer(
  Effect.gen(function* ProjectRpcsLive() {
    const projectService = yield* ProjectService;
    return {
      CreateProject: ({ name, organizationId }) =>
        projectService.createProject({ name, organizationId }),
      DeleteProject: ({ id }) => projectService.deleteProject({ id }),
      ListProjects: ({ organizationId }) =>
        projectService.getProjects(organizationId),
      UpdateProject: ({ id, name }) =>
        projectService.updateProject({ id, name }),
    };
  })
).pipe(Layer.provide(ProjectService.Default));
