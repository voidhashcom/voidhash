import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listProductsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListProducts(options))),
    queryKey: queryKeys.product.list(options),
  });

export const getProductOptions = (options: { productId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetProduct({
            id: options.productId,
          })
        )
      ),
    queryKey: queryKeys.product.getProduct(options),
  });

export const createProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProduct(variables))),
    mutationKey: ["createProduct"],
  });

export const updateProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; name: string; slug?: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProduct(variables))),
    mutationKey: ["updateProduct"],
  });

export const deleteProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProduct(variables))),
    mutationKey: ["deleteProduct"],
  });
