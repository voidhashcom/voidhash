import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listProductsOptions = (options: { projectId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.product.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListProducts(options)))
  });

export const getProductOptions = (options: { productId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.product.getProduct(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.GetProduct(options)))
  });

export const createProductOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createProduct',
    mutationFn: (variables: { projectId: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProduct(variables)))
  });

export const updateProductOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'updateProduct',
    mutationFn: (variables: { productId: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProduct(variables)))
  });

export const deleteProductOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deleteProduct',
    mutationFn: (variables: { productId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProduct(variables)))
  });
