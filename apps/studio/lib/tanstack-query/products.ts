import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listProductsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.product.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListProducts(options)))
  });

export const getProductOptions = (options: { productId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.product.getProduct(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetProduct({
            id: options.productId
          })
        )
      )
  });

export const createProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createProduct'],
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProduct(variables)))
  });

export const updateProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['updateProduct'],
    mutationFn: (variables: { id: string; name: string; slug?: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProduct(variables)))
  });

export const deleteProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deleteProduct'],
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProduct(variables)))
  });
