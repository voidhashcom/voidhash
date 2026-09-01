import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaywallAssetNotFoundError,
  RpcPaywallAssetServiceError,
  RpcPaywallAssetValidationError,
} from "../errors/PaywallAsset.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** One stored paywall asset as returned over the wire. */
export const PaywallAsset = Schema.Struct({
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
export type PaywallAsset = typeof PaywallAsset.Type;

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
    success: PaywallAsset,
  }),
  Rpc.make("ListPaywallAssets", {
    error: Schema.Union([RpcPaywallAssetServiceError, RpcActionForbiddenError]),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Array(PaywallAsset),
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
    success: PaywallAsset,
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

export { PaywallAsset as PaywallAssetSchema };
