import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaywallLocationNotFoundError,
  RpcPaywallLocationServiceError,
  RpcPaywallLocationShowingValidationError,
  RpcPaywallLocationSlugAlreadyExistsError,
} from "../errors/PaywallLocation.ts";
import { RpcPaywallNotFoundError } from "../errors/paywall.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const RpcPaywallLocationShowingType = Schema.Union([
  Schema.Literal("paywall_release"),
  Schema.Literal("feature_flag"),
]);

export const RpcPaywallLocationShowingPaywall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});

export const RpcPaywallLocationShowingPaywallRelease = Schema.Struct({
  htmlUrl: Schema.String,
  publishedAt: Schema.NullOr(Schema.Date),
  releaseId: Schema.String,
  version: Schema.Number,
});

export const RpcPaywallLocationShowing = Schema.Struct({
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  endedAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.NullOr(Schema.String),
  id: Schema.String,
  paywall: Schema.NullOr(RpcPaywallLocationShowingPaywall),
  paywallId: Schema.NullOr(Schema.String),
  paywallLocationId: Schema.String,
  paywallRelease: Schema.NullOr(RpcPaywallLocationShowingPaywallRelease),
  paywallReleaseId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  startedAt: Schema.Date,
  type: RpcPaywallLocationShowingType,
  updatedAt: Schema.NullOr(Schema.Date),
});

export const RpcPaywallLocation = Schema.Struct({
  activeShowing: Schema.NullOr(RpcPaywallLocationShowing),
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

const commonError = Schema.Union([RpcActionForbiddenError, RpcPaywallLocationServiceError]);

const locationNotFoundError = Schema.Union([
  RpcActionForbiddenError,
  RpcPaywallLocationNotFoundError,
  RpcPaywallLocationServiceError,
]);

export class PaywallLocationRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaywallLocations", {
    error: commonError,
    payload: Schema.Struct({
      includeArchived: Schema.optional(Schema.Boolean),
      projectId: Schema.String,
    }),
    success: Schema.Array(RpcPaywallLocation),
  }),
  Rpc.make("CreatePaywallLocation", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaywallLocationServiceError,
      RpcPaywallLocationSlugAlreadyExistsError,
    ]),
    payload: Schema.Struct({
      description: Schema.optional(Schema.String),
      name: Schema.String,
      projectId: Schema.String,
      slug: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePaywallLocation", {
    error: locationNotFoundError,
    payload: Schema.Struct({
      description: Schema.optional(Schema.NullOr(Schema.String)),
      locationId: Schema.String,
      name: Schema.optional(Schema.String),
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("ArchivePaywallLocation", {
    error: locationNotFoundError,
    payload: Schema.Struct({
      locationId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("AssignPaywallLocationShowing", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaywallLocationNotFoundError,
      RpcPaywallLocationServiceError,
      RpcPaywallLocationShowingValidationError,
      RpcPaywallNotFoundError,
    ]),
    payload: Schema.Struct({
      featureFlagId: Schema.optional(Schema.String),
      locationId: Schema.String,
      paywallId: Schema.optional(Schema.String),
      type: RpcPaywallLocationShowingType,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("ClearPaywallLocationShowing", {
    error: locationNotFoundError,
    payload: Schema.Struct({
      locationId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("ListPaywallLocationShowings", {
    error: locationNotFoundError,
    payload: Schema.Struct({
      locationId: Schema.String,
    }),
    success: Schema.Array(RpcPaywallLocationShowing),
  }),
).middleware(AuthMiddleware) {}
