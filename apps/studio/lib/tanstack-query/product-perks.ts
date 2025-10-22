import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listProductPerksByProductIdOptions = (options: {
  productId: string;
}) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.productPerk.listByProduct({
      productId: options.productId
    }),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListProductPerksByProductId({ productId: options.productId })
        )
      )
  });

export const createProductPerkOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createProductPerk',
    mutationFn: (variables: { productId: string; perkId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateProductPerk(variables))
      )
  });

export const deleteProductPerkOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deleteProductPerk',
    mutationFn: (variables: { productId: string; perkId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteProductPerk(variables))
      )
  });
