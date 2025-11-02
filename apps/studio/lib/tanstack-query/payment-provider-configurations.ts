import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listPaymentProviderConfigurationsOptions = (options: {
  projectId: string;
}) => {
  return eq.queryOptions({
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
  eq.queryOptions({
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
  eq.mutationOptions({
    mutationKey: ['createPaymentProviderConfiguration'],
    mutationFn: (variables: { projectId: string; providerId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.CreatePaymentProviderConfiguration(variables)
        )
      )
  });

export const updatePaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationKey: ['updatePaymentProviderConfiguration'],
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
  eq.mutationOptions({
    mutationKey: ['deletePaymentProviderConfiguration'],
    mutationFn: (variables: { paymentProviderConfigurationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.DeletePaymentProviderConfiguration(variables)
        )
      )
  });
