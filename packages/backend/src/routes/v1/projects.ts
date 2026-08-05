import { Project, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiProjectServiceError,
} from "@voidhash/api-contracts/errors";
import { ProjectService } from "@voidhash/core/services";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const ProjectsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "projects", (handlers) =>
  Effect.gen(function* () {
    const projectService = yield* ProjectService;
    return handlers
      .handle("createProject", ({ payload }) =>
        bridgeAuthSession(
          projectService
            .createProject({
              name: payload.name,
              organizationId: payload.organizationId,
            })
            .pipe(Effect.map((project) => new Project(project))),
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
      .handle("listProjects", ({ params: { organizationId } }) =>
        bridgeAuthSession(
          projectService
            .getProjects(organizationId)
            .pipe(
              Effect.map((projectsList) => projectsList.map((project) => new Project(project))),
            ),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProjectServiceError: (e) => Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
