import { PaywallAssetService, type PaywallAssetRow } from "@voidhash/core/services";
import {
  type PaywallAsset,
  PaywallAssetRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallAssetNotFoundError,
  RpcPaywallAssetServiceError,
  RpcPaywallAssetValidationError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

const toRpcPaywallAsset = (asset: PaywallAssetRow): PaywallAsset => ({
  ...asset,
  width: Option.getOrNull(asset.width),
  height: Option.getOrNull(asset.height),
});

export const PaywallAssetRpcsLive = PaywallAssetRpcsDef.toLayer(
  Effect.gen(function* PaywallAssetRpcsLive() {
    const paywallAssetService = yield* PaywallAssetService;
    return {
      UploadPaywallAsset: ({ organizationId, name, contentType, imageBase64, width, height }) =>
        paywallAssetService
          .upload({
            organizationId,
            name,
            contentType,
            imageBase64,
            width: Option.fromNullishOr(width),
            height: Option.fromNullishOr(height),
          })
          .pipe(
            Effect.map(toRpcPaywallAsset),
            Effect.catchTags({
              PaywallAssetForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              PaywallAssetValidationError: (error) =>
                Effect.fail(new RpcPaywallAssetValidationError({ message: error.message })),
              PaywallAssetServiceError: (error) =>
                Effect.fail(new RpcPaywallAssetServiceError({ message: error.message })),
            }),
          ),
      ListPaywallAssets: ({ organizationId }) =>
        paywallAssetService.list({ organizationId }).pipe(
          Effect.map((assets) => assets.map(toRpcPaywallAsset)),
          Effect.catchTags({
            PaywallAssetForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallAssetServiceError: (error) =>
              Effect.fail(new RpcPaywallAssetServiceError({ message: error.message })),
          }),
        ),
      RenamePaywallAsset: ({ assetId, name }) =>
        paywallAssetService.rename({ assetId, name }).pipe(
          Effect.map(toRpcPaywallAsset),
          Effect.catchTags({
            PaywallAssetForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallAssetNotFoundError: (error) =>
              Effect.fail(new RpcPaywallAssetNotFoundError({ assetId: error.assetId })),
            PaywallAssetServiceError: (error) =>
              Effect.fail(new RpcPaywallAssetServiceError({ message: error.message })),
          }),
        ),
      DeletePaywallAsset: ({ assetId }) =>
        paywallAssetService.delete({ assetId }).pipe(
          Effect.catchTags({
            PaywallAssetForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallAssetNotFoundError: (error) =>
              Effect.fail(new RpcPaywallAssetNotFoundError({ assetId: error.assetId })),
            PaywallAssetServiceError: (error) =>
              Effect.fail(new RpcPaywallAssetServiceError({ message: error.message })),
          }),
        ),
    };
  }),
);
