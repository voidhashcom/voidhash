import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  OrganizationNotFoundError,
  OrganizationServiceError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});

export class OrganizationRpcsDef extends RpcGroup.make(
  Rpc.make("CreateOrganization", {
    error: OrganizationServiceError,
    payload: {
      name: Schema.String,
    },
    success: Organization,
  }),
  Rpc.make("UpdateOrganization", {
    error: Schema.Union(
      OrganizationServiceError,
      ActionForbiddenError,
      OrganizationNotFoundError
    ),
    payload: {
      name: Schema.String,
      organizationId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("DeleteOrganization", {
    error: Schema.Union(OrganizationServiceError, ActionForbiddenError),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
