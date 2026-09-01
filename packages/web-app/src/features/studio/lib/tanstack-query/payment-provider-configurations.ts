import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaymentProviderConfigurationsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaymentProviderConfigurations(options)),
    queryKey: queryKeys.paymentProviderConfiguration.list(options),
  });

export const getPaymentProviderConfigurationOptions = (options: { id: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetPaymentProviderConfiguration(options)),
    queryKey: queryKeys.paymentProviderConfiguration.getPaymentProviderConfiguration(options),
  });

export const createPaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; providerId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreatePaymentProviderConfiguration(variables)),
    mutationKey: ["createPaymentProviderConfiguration"],
  });

export const updatePaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      enabled: boolean;
      name: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.request((rpc) =>
        rpc.UpdatePaymentProviderConfiguration({
          ...variables,
          isEnabled: variables.enabled,
        }),
      ),
    mutationKey: ["updatePaymentProviderConfiguration"],
  });

export const deletePaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paymentProviderConfigurationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeletePaymentProviderConfiguration(variables)),
    mutationKey: ["deletePaymentProviderConfiguration"],
  });
