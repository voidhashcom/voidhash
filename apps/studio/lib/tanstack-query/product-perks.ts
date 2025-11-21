import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listProductPerksByProductIdOptions = (options: {
  productId: string;
}) =>
  eq.queryOptions({
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
  eq.mutationOptions({
    mutationKey: ['createProductPerk'],
    mutationFn: (variables: { productId: string; perkId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateProductPerk(variables))
      )
  });

export const deleteProductPerkOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deleteProductPerk'],
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteProductPerk(variables))
      )
  });
