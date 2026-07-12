import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries
export const listPaywallAssetsOptions = (options: { organizationId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywallAssets(options)),
    queryKey: queryKeys.paywallAsset.list(options),
  });

// Mutations
export const uploadPaywallAssetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      organizationId: string;
      name: string;
      contentType: string;
      imageBase64: string;
      width?: number;
      height?: number;
    }) => VoidhashRpc.request((rpc) => rpc.UploadPaywallAsset(variables)),
    mutationKey: ["uploadPaywallAsset"],
  });

export const renamePaywallAssetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { assetId: string; name: string }) =>
      VoidhashRpc.request((rpc) => rpc.RenamePaywallAsset(variables)),
    mutationKey: ["renamePaywallAsset"],
  });

export const deletePaywallAssetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { assetId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeletePaywallAsset(variables)),
    mutationKey: ["deletePaywallAsset"],
  });
