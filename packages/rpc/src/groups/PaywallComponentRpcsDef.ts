import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import { RpcPaywallDeployServiceError } from "../errors/PaywallDeploy.ts";
import { AuthMiddleware } from "../middlewares.ts";

/**
 * One component version with the read-time catalog detail the editor needs.
 * `manifest` is the raw §2 component manifest JSON (decoded by the designer
 * feature layer, never here); `previewStates`/`hasPanel` derive from the
 * minting deploy's manifest; `artifactBaseUrl` is the server-constructed
 * `{publicBaseUrl}/c/<contentHash>` base of the §5.1 serving layout.
 */
export const RpcPaywallComponentVersion = Schema.Struct({
  artifactBaseUrl: Schema.String,
  contentHash: Schema.String,
  createdAt: Schema.Date,
  hasPanel: Schema.Boolean,
  manifest: Schema.Unknown,
  previewStates: Schema.Array(Schema.String),
  slug: Schema.String,
  version: Schema.Number,
});

/** Summary of an older component version (no manifest/catalog detail). */
export const RpcPaywallComponentVersionSummary = Schema.Struct({
  contentHash: Schema.String,
  createdAt: Schema.Date,
  version: Schema.Number,
});

export const RpcPaywallComponent = Schema.Struct({
  componentId: Schema.String,
  latest: RpcPaywallComponentVersion,
  latestVersion: Schema.Number,
  previousVersions: Schema.Array(RpcPaywallComponentVersionSummary),
  slug: Schema.String,
  title: Schema.NullOr(Schema.String),
});

export class PaywallComponentRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaywallComponents", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallDeployServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(RpcPaywallComponent),
  }),
  Rpc.make("GetPaywallComponentVersions", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallDeployServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
      refs: Schema.Array(
        Schema.Struct({
          slug: Schema.String,
          version: Schema.Number,
        }),
      ),
    }),
    success: Schema.Array(RpcPaywallComponentVersion),
  }),
).middleware(AuthMiddleware) {}
