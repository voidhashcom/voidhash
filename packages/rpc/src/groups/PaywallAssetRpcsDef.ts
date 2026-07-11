import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaywallAssetNotFoundError,
  RpcPaywallAssetServiceError,
  RpcPaywallAssetValidationError,
} from "../errors/PaywallAsset.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** One stored paywall asset as returned over the wire. */
export const PaywallAssetSchema = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  name: Schema.String,
  url: Schema.String,
  contentType: Schema.String,
  sizeBytes: Schema.Number,
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  createdAt: Schema.Date,
});

/**
 * Organization-scoped paywall image asset library, gated by
 * {@link AuthMiddleware}. Every member of an organization may upload, list,
 * rename, and delete its assets; authorization is a plain membership check
 * resolved server-side from the session.
 */
export class PaywallAssetRpcsDef extends RpcGroup.make(
  Rpc.make("UploadPaywallAsset", {
    error: Schema.Union([
      RpcPaywallAssetServiceError,
      RpcActionForbiddenError,
      RpcPaywallAssetValidationError,
    ]),
    payload: {
      organizationId: Schema.String,
      /** Display name; the studio defaults this to the original filename. */
      name: Schema.String,
      contentType: Schema.String,
      imageBase64: Schema.String,
      width: Schema.optional(Schema.Number),
      height: Schema.optional(Schema.Number),
    },
    success: PaywallAssetSchema,
  }),
  Rpc.make("ListPaywallAssets", {
    error: Schema.Union([RpcPaywallAssetServiceError, RpcActionForbiddenError]),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Array(PaywallAssetSchema),
  }),
  Rpc.make("RenamePaywallAsset", {
    error: Schema.Union([
      RpcPaywallAssetServiceError,
      RpcActionForbiddenError,
      RpcPaywallAssetNotFoundError,
    ]),
    payload: {
      assetId: Schema.String,
      name: Schema.String,
    },
    success: PaywallAssetSchema,
  }),
  Rpc.make("DeletePaywallAsset", {
    error: Schema.Union([
      RpcPaywallAssetServiceError,
      RpcActionForbiddenError,
      RpcPaywallAssetNotFoundError,
    ]),
    payload: {
      assetId: Schema.String,
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
