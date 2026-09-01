import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import {
  RpcActionForbiddenError,
  RpcAuthenticationError,
  RpcAvatarValidationError,
} from "../errors/common.ts";
import { RpcProjectNotFoundError, RpcProjectServiceError } from "../errors/project.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const Project = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});
export type Project = typeof Project.Type;

export class ProjectRpcsDef extends RpcGroup.make(
  Rpc.make("CreateProject", {
    error: Schema.Union([RpcActionForbiddenError, RpcAuthenticationError, RpcProjectServiceError]),
    payload: {
      name: Schema.String,
      organizationId: Schema.String,
    },
    success: Project,
  }),
  Rpc.make("ListProjects", {
    error: Schema.Union([RpcActionForbiddenError, RpcProjectServiceError]),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Array(Project),
  }),
  Rpc.make("UpdateProject", {
    error: Schema.Union([RpcActionForbiddenError, RpcProjectServiceError, RpcProjectNotFoundError]),
    payload: {
      id: Schema.String,
      name: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("DeleteProject", {
    error: Schema.Union([RpcActionForbiddenError, RpcProjectServiceError, RpcProjectNotFoundError]),
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("SetProjectAvatar", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProjectServiceError,
      RpcProjectNotFoundError,
      RpcAvatarValidationError,
    ]),
    payload: {
      contentType: Schema.String,
      id: Schema.String,
      imageBase64: Schema.String,
    },
    success: Schema.Struct({ logoUrl: Schema.String }),
  }),
  Rpc.make("RemoveProjectAvatar", {
    error: Schema.Union([RpcActionForbiddenError, RpcProjectServiceError, RpcProjectNotFoundError]),
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
