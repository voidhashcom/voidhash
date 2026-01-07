import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listProviderProductsByProductIdOptions = (options: {
  productId: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.ListProviderProductsByProductId(options))
      ),
    queryKey: queryKeys.paymentProviderProduct.listByProduct(options),
  });

export const createPaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      productId: string;
      paymentProviderConfigurationId: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreatePaymentProviderProduct(variables))
      ),
    mutationKey: ["createPaymentProviderProduct"],
  });

export const updatePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.UpdatePaymentProviderProduct(variables))
      ),
    mutationKey: ["updatePaymentProviderProduct"],
  });

export const deletePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeletePaymentProviderProduct(variables))
      ),
    mutationKey: ["deletePaymentProviderProduct"],
  });

export const setActivePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      productId: string;
      paymentProviderConfigurationId: string;
      providerProductKey: string;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.SetActivePaymentProviderProduct(variables))
      ),
    mutationKey: ["setActivePaymentProviderProduct"],
  });
