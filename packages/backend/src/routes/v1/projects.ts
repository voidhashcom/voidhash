import { createdResponse, Project, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiProjectNotFoundError,
  ApiProjectServiceError,
} from "@voidhash/api-contracts/errors";
import { ProjectNotFoundError } from "@voidhash/core/domain/project/Project";
import { ProjectService } from "@voidhash/core/services";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Project administration is a dashboard/user-session concern. */
const USER_ONLY: ReadonlyArray<ApiCredentialMethod> = ["user"];

/** Reads additionally accept a secret key, which is scoped to one project. */
const USER_OR_SECRET_KEY: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

export const ProjectsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "projects", (handlers) =>
  Effect.gen(function* () {
    const projectService = yield* ProjectService;

    /** Reads a project back after a write, failing if it vanished meanwhile. */
    const requireProject = Effect.fnUntraced(function* (projectId: string) {
      const project = yield* projectService.getProjectById(projectId);
      if (!project) {
        return yield* Effect.fail(new ProjectNotFoundError({ projectId }));
      }
      return new Project({ id: project.id, name: project.name, slug: project.slug });
    });

    return handlers
      .handle("createProject", ({ payload }) =>
        bridgeAuthSession(
          Effect.fn("ProjectsGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, USER_ONLY);
            const project = yield* projectService.createProject({
              name: payload.name,
              organizationId: payload.organizationId,
            });
            const created = new Project(project);
            return yield* createdResponse(Project, created, `/projects/${created.id}`);
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuthenticationError: (e) =>
              Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
            ProjectServiceError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getProjectById", ({ params }) =>
        bridgeAuthSession(
          Effect.fn("ProjectsGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, USER_OR_SECRET_KEY);
            const projectId = yield* resolveRequestProjectId(authSession, params.projectId);
            return yield* requireProject(projectId);
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProjectNotFoundError: (e) =>
              Effect.fail(new ApiProjectNotFoundError({ projectId: e.projectId })),
            ProjectServiceError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updateProject", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.fn("ProjectsGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, USER_ONLY);
            const projectId = yield* resolveRequestProjectId(authSession, params.projectId);
            if (payload.name !== undefined) {
              yield* projectService.updateProject({ id: projectId, name: payload.name });
            }
            return yield* requireProject(projectId);
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
            ProjectNotFoundError: (e) =>
              Effect.fail(new ApiProjectNotFoundError({ projectId: e.projectId })),
            ProjectServiceError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("deleteProject", ({ params }) =>
        bridgeAuthSession(
          Effect.fn("ProjectsGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, USER_ONLY);
            const projectId = yield* resolveRequestProjectId(authSession, params.projectId);
            return yield* projectService.deleteProject({ id: projectId });
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
            ProjectNotFoundError: (e) =>
              Effect.fail(new ApiProjectNotFoundError({ projectId: e.projectId })),
            ProjectServiceError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
