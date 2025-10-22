import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listPaymentProviderConfigurationsOptions = (options: {
  projectId: string;
}) => {
  return effectQuery.queryOptions({
    queryKey: queryKeys.paymentProviderConfiguration.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.ListPaymentProviderConfigurations(options))
      )
  });
};

export const getPaymentProviderConfigurationOptions = (options: {
  id: string;
}) =>
  effectQuery.queryOptions({
    queryKey:
      queryKeys.paymentProviderConfiguration.getPaymentProviderConfiguration(
        options
      ),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.GetPaymentProviderConfiguration(options))
      )
  });

export const createPaymentProviderConfigurationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createPaymentProviderConfiguration',
    mutationFn: (variables: { projectId: string; providerId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.CreatePaymentProviderConfiguration(variables)
        )
      )
  });

export const updatePaymentProviderConfigurationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'updatePaymentProviderConfiguration',
    mutationFn: (variables: {
      id: string;
      enabled: boolean;
      name: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.UpdatePaymentProviderConfiguration(variables)
        )
      )
  });

export const deletePaymentProviderConfigurationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deletePaymentProviderConfiguration',
    mutationFn: (variables: { paymentProviderConfigurationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.DeletePaymentProviderConfiguration(variables)
        )
      )
  });
