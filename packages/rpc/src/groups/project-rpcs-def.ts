import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  AuthenticationError,
  ProjectNotFoundError,
  ProjectServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export class Project extends Schema.Class<Project>('Project')({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
}) {}

export class ProjectRpcsDef extends RpcGroup.make(
  Rpc.make('CreateProject', {
    success: Project,
    payload: {
      name: Schema.String,
      organizationId: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      AuthenticationError,
      ProjectServiceError
    )
  }),
  Rpc.make('ListProjects', {
    success: Schema.Array(Project),
    payload: {
      organizationId: Schema.String
    },
    error: Schema.Union(ActionForbiddenError, ProjectServiceError)
  }),
  Rpc.make('UpdateProject', {
    success: Schema.Void,
    payload: {
      id: Schema.String,
      name: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      ProjectServiceError,
      ProjectNotFoundError
    )
  }),
  Rpc.make('DeleteProject', {
    success: Schema.Void,
    payload: {
      id: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      ProjectServiceError,
      ProjectNotFoundError
    )
  })
).middleware(AuthMiddleware) {}
