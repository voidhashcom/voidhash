import { Effect } from "effect";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listProductPerksByProductIdOptions = (options: { productId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc.ListProductPerksByProductId({ productId: options.productId }),
      ),
    queryKey: queryKeys.productPerk.listByProduct({
      productId: options.productId,
    }),
  });

export const createProductPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { productId: string; perkId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateProductPerk(variables)),
    mutationKey: ["createProductPerk"],
  });

export const deleteProductPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteProductPerk(variables)),
    mutationKey: ["deleteProductPerk"],
  });
