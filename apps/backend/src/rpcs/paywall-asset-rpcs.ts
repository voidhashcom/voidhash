import { PaywallAssetService } from "@voidhash/core/services";
import {
  PaywallAssetRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallAssetNotFoundError,
  RpcPaywallAssetServiceError,
  RpcPaywallAssetValidationError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaywallAssetRpcsLive = PaywallAssetRpcsDef.toLayer(
  Effect.gen(function* PaywallAssetRpcsLive() {
    const paywallAssetService = yield* PaywallAssetService;
    return {
      UploadPaywallAsset: ({ organizationId, name, contentType, imageBase64, width, height }) =>
        paywallAssetService
          .upload({ organizationId, name, contentType, imageBase64, width, height })
          .pipe(
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
          Effect.catchTags({
            PaywallAssetForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallAssetServiceError: (error) =>
              Effect.fail(new RpcPaywallAssetServiceError({ message: error.message })),
          }),
        ),
      RenamePaywallAsset: ({ assetId, name }) =>
        paywallAssetService.rename({ assetId, name }).pipe(
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
