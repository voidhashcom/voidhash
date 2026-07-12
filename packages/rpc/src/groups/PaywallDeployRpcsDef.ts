import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaywallDeployServiceError,
  RpcPaywallDeployValidationError,
} from "../errors/PaywallDeploy.ts";
import { RpcReleaseNotFoundError } from "../errors/paywall.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const RpcPaywallDeployStatus = Schema.Literals(["pending", "ready"]);

/** Per-deploy paywall summary (manifest-derived, enriched with release rows). */
export const RpcPaywallDeployPaywallSummary = Schema.Struct({
  contentHash: Schema.String,
  releaseId: Schema.NullOr(Schema.String),
  slug: Schema.String,
  version: Schema.NullOr(Schema.Number),
});

/** Per-deploy component summary (manifest-derived, enriched with version rows). */
export const RpcPaywallDeployComponentSummary = Schema.Struct({
  componentId: Schema.NullOr(Schema.String),
  contentHash: Schema.String,
  slug: Schema.String,
  version: Schema.NullOr(Schema.Number),
});

export const RpcPaywallDeploy = Schema.Struct({
  cliVersion: Schema.String,
  components: Schema.Array(RpcPaywallDeployComponentSummary),
  createdAt: Schema.Date,
  createdByName: Schema.String,
  id: Schema.String,
  paywalls: Schema.Array(RpcPaywallDeployPaywallSummary),
  runtimeVersion: Schema.String,
  schemaVersion: Schema.Number,
  status: RpcPaywallDeployStatus,
});

export class PaywallDeployRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaywallDeploys", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallDeployServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(RpcPaywallDeploy),
  }),
  Rpc.make("SetActivePaywallRelease", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaywallDeployServiceError,
      RpcPaywallDeployValidationError,
      RpcReleaseNotFoundError,
    ]),
    payload: Schema.Struct({
      releaseId: Schema.String,
    }),
    success: Schema.Struct({
      releaseId: Schema.String,
    }),
  }),
).middleware(AuthMiddleware) {}
