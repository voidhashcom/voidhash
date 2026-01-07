import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listProductPerksByProductIdOptions = (options: {
  productId: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListProductPerksByProductId({ productId: options.productId })
        )
      ),
    queryKey: queryKeys.productPerk.listByProduct({
      productId: options.productId,
    }),
  });

export const createProductPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { productId: string; perkId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateProductPerk(variables))
      ),
    mutationKey: ["createProductPerk"],
  });

export const deleteProductPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteProductPerk(variables))
      ),
    mutationKey: ["deleteProductPerk"],
  });
