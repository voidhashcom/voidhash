import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  OrganizationNotFoundError,
  OrganizationServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
});

export class OrganizationRpcsDef extends RpcGroup.make(
  Rpc.make('CreateOrganization', {
    success: Organization,
    payload: {
      name: Schema.String
    },
    error: OrganizationServiceError
  }),
  Rpc.make('UpdateOrganization', {
    success: Schema.Void,
    payload: {
      organizationId: Schema.String,
      name: Schema.String
    },
    error: Schema.Union(
      OrganizationServiceError,
      ActionForbiddenError,
      OrganizationNotFoundError
    )
  }),
  Rpc.make('DeleteOrganization', {
    success: Schema.Void,
    payload: {
      organizationId: Schema.String
    },
    error: Schema.Union(OrganizationServiceError, ActionForbiddenError)
  })
).middleware(AuthMiddleware) {}
