import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  AuthenticationError,
  ProjectNotFoundError,
  ProjectServiceError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const Project = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});

export class ProjectRpcsDef extends RpcGroup.make(
  Rpc.make("CreateProject", {
    error: Schema.Union(
      ActionForbiddenError,
      AuthenticationError,
      ProjectServiceError
    ),
    payload: {
      name: Schema.String,
      organizationId: Schema.String,
    },
    success: Project,
  }),
  Rpc.make("ListProjects", {
    error: Schema.Union(ActionForbiddenError, ProjectServiceError),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Array(Project),
  }),
  Rpc.make("UpdateProject", {
    error: Schema.Union(
      ActionForbiddenError,
      ProjectServiceError,
      ProjectNotFoundError
    ),
    payload: {
      id: Schema.String,
      name: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("DeleteProject", {
    error: Schema.Union(
      ActionForbiddenError,
      ProjectServiceError,
      ProjectNotFoundError
    ),
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
