import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { RpcActionForbiddenError } from "../errors/common.ts";
import { RpcDevelopmentModeServiceError } from "../errors/development-mode.ts";
import { AuthMiddleware } from "../middlewares.ts";

const DevelopmentModeError = Schema.Union([
  RpcActionForbiddenError,
  RpcDevelopmentModeServiceError,
]);

const DevelopmentState = Schema.Struct({
  developmentPurchasesEnabled: Schema.Boolean,
  grants: Schema.Array(
    Schema.Struct({
      expiresAt: Schema.NullOr(Schema.Date),
      id: Schema.String,
      perkId: Schema.String,
      status: Schema.Number,
    }),
  ),
  purchases: Schema.Array(
    Schema.Struct({
      createdAt: Schema.NullOr(Schema.Date),
      id: Schema.String,
      productId: Schema.String,
      productName: Schema.String,
      productSlug: Schema.String,
      refundedAt: Schema.NullOr(Schema.Date),
      revokedAt: Schema.NullOr(Schema.Date),
    }),
  ),
  subscriptions: Schema.Array(
    Schema.Struct({
      canceledAt: Schema.NullOr(Schema.Date),
      expiresAt: Schema.NullOr(Schema.Date),
      gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
      id: Schema.String,
      productId: Schema.String,
      productName: Schema.String,
      productSlug: Schema.String,
      startsAt: Schema.Date,
      status: Schema.Number,
    }),
  ),
});

export class DevelopmentModeRpcsDef extends RpcGroup.make(
  Rpc.make("GetDevelopmentModeSettings", {
    error: DevelopmentModeError,
    payload: Schema.Struct({ projectId: Schema.String }),
    success: Schema.Struct({ developmentPurchasesEnabled: Schema.Boolean }),
  }),
  Rpc.make("GetDevelopmentModeState", {
    error: DevelopmentModeError,
    payload: Schema.Struct({ personId: Schema.String, projectId: Schema.String }),
    success: DevelopmentState,
  }),
  Rpc.make("ApplyDevelopmentLifecycleAction", {
    error: DevelopmentModeError,
    payload: Schema.Struct({
      action: Schema.Literals(["expire", "revoke", "renew", "refund", "grace_period"]),
      actionId: Schema.String,
      projectId: Schema.String,
      targetId: Schema.String,
      targetType: Schema.Literals(["subscription", "purchase"]),
    }),
    success: Schema.Void,
  }),
  Rpc.make("SetDevelopmentPurchasesEnabled", {
    error: DevelopmentModeError,
    payload: Schema.Struct({ enabled: Schema.Boolean, projectId: Schema.String }),
    success: Schema.Void,
  }),
  Rpc.make("ResetDevelopmentData", {
    error: DevelopmentModeError,
    payload: Schema.Struct({ projectId: Schema.String }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
