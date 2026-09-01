import { ProjectService } from "@voidhash/core/services";
import {
  ProjectRpcsDef,
  RpcActionForbiddenError,
  RpcAuthenticationError,
  RpcAvatarValidationError,
  RpcProjectNotFoundError,
  RpcProjectServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";

export const ProjectRpcsLive = ProjectRpcsDef.toLayer(
  Effect.gen(function* ProjectRpcsLive() {
    const projectService = yield* ProjectService;
    return {
      CreateProject: ({ name, organizationId }) =>
        projectService.createProject({ name, organizationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuthenticationError: (error) =>
              Effect.fail(
                new RpcAuthenticationError({ cause: error.cause, message: error.message }),
              ),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
      DeleteProject: ({ id }) =>
        projectService.deleteProject({ id }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProjectNotFoundError: (error) =>
              Effect.fail(new RpcProjectNotFoundError({ projectId: error.projectId })),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
      ListProjects: ({ organizationId }) =>
        projectService.getProjects(organizationId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
      RemoveProjectAvatar: ({ id }) =>
        projectService.removeAvatar({ id }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
            ProjectNotFoundError: (error) =>
              Effect.fail(new RpcProjectNotFoundError({ projectId: error.projectId })),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
      SetProjectAvatar: ({ contentType, id, imageBase64 }) =>
        projectService.setAvatar({ contentType, id, imageBase64 }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
            AvatarValidationError: (error) =>
              Effect.fail(new RpcAvatarValidationError({ message: error.message })),
            ProjectNotFoundError: (error) =>
              Effect.fail(new RpcProjectNotFoundError({ projectId: error.projectId })),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
      UpdateProject: ({ id, name }) =>
        projectService.updateProject({ id, name }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProjectNotFoundError: (error) =>
              Effect.fail(new RpcProjectNotFoundError({ projectId: error.projectId })),
            ProjectServiceError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcProjectServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
