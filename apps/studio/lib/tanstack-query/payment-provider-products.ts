import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listProviderProductsByProductIdOptions = (options: {
  productId: string;
}) =>
  eq.queryOptions({
    queryKey: queryKeys.paymentProviderProduct.listByProduct(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.ListProviderProductsByProductId(options))
      )
  });

export const createPaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createPaymentProviderProduct'],
    mutationFn: (variables: {
      productId: string;
      paymentProviderConfigurationId: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreatePaymentProviderProduct(variables))
      )
  });

export const updatePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['updatePaymentProviderProduct'],
    mutationFn: (variables: {
      id: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.UpdatePaymentProviderProduct(variables))
      )
  });

export const deletePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deletePaymentProviderProduct'],
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeletePaymentProviderProduct(variables))
      )
  });

export const setActivePaymentProviderProductOptions = () =>
  eq.mutationOptions({
    mutationKey: ['setActivePaymentProviderProduct'],
    mutationFn: (variables: {
      productId: string;
      paymentProviderConfigurationId: string;
      providerProductKey: string;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.SetActivePaymentProviderProduct(variables))
      )
  });
