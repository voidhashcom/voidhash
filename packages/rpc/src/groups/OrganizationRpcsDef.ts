import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError, RpcAvatarValidationError } from "../errors/common.ts";
import {
  RpcOrganizationNotFoundError,
  RpcOrganizationServiceError,
} from "../errors/organization.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});
export type Organization = typeof Organization.Type;

export class OrganizationRpcsDef extends RpcGroup.make(
  Rpc.make("CreateOrganization", {
    error: RpcOrganizationServiceError,
    payload: {
      name: Schema.String,
    },
    success: Organization,
  }),
  Rpc.make("UpdateOrganization", {
    error: Schema.Union([
      RpcOrganizationServiceError,
      RpcActionForbiddenError,
      RpcOrganizationNotFoundError,
    ]),
    payload: {
      name: Schema.String,
      organizationId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("DeleteOrganization", {
    error: Schema.Union([RpcOrganizationServiceError, RpcActionForbiddenError]),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("SetOrganizationAvatar", {
    error: Schema.Union([
      RpcOrganizationServiceError,
      RpcActionForbiddenError,
      RpcOrganizationNotFoundError,
      RpcAvatarValidationError,
    ]),
    payload: {
      contentType: Schema.String,
      imageBase64: Schema.String,
      organizationId: Schema.String,
    },
    success: Schema.Struct({ logoUrl: Schema.String }),
  }),
  Rpc.make("RemoveOrganizationAvatar", {
    error: Schema.Union([
      RpcOrganizationServiceError,
      RpcActionForbiddenError,
      RpcOrganizationNotFoundError,
    ]),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
