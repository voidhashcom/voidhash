import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaymentProviderConfigurationsOptions = (options: {
  projectId: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.ListPaymentProviderConfigurations(options))
      ),
    queryKey: queryKeys.paymentProviderConfiguration.list(options),
  });

export const getPaymentProviderConfigurationOptions = (options: {
  id: string;
}) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.GetPaymentProviderConfiguration(options))
      ),
    queryKey:
      queryKeys.paymentProviderConfiguration.getPaymentProviderConfiguration(
        options
      ),
  });

export const createPaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; providerId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.CreatePaymentProviderConfiguration(variables)
        )
      ),
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
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.UpdatePaymentProviderConfiguration(variables)
        )
      ),
    mutationKey: ["updatePaymentProviderConfiguration"],
  });

export const deletePaymentProviderConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paymentProviderConfigurationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.DeletePaymentProviderConfiguration(variables)
        )
      ),
    mutationKey: ["deletePaymentProviderConfiguration"],
  });
