import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPushNotificationConfigurationsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPushNotificationConfigurations(options)),
    queryKey: queryKeys.pushNotificationConfiguration.list(options),
  });

export const getPushNotificationConfigurationOptions = (options: { id: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetPushNotificationConfiguration(options)),
    queryKey: queryKeys.pushNotificationConfiguration.getPushNotificationConfiguration(options),
  });

export const createPushNotificationConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; providerId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreatePushNotificationConfiguration(variables)),
    mutationKey: ["createPushNotificationConfiguration"],
  });

export const updatePushNotificationConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      enabled: boolean;
      name: string;
      configuration: Record<string, unknown>;
    }) =>
      VoidhashRpc.request((rpc) =>
        rpc.UpdatePushNotificationConfiguration({
          ...variables,
          isEnabled: variables.enabled,
        }),
      ),
    mutationKey: ["updatePushNotificationConfiguration"],
  });

export const deletePushNotificationConfigurationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { pushNotificationConfigurationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeletePushNotificationConfiguration(variables)),
    mutationKey: ["deletePushNotificationConfiguration"],
  });

export const listPushNotificationSendsOptions = (options: { projectId: string; limit: number }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc.ListPushNotificationSends({
          limit: options.limit,
          projectId: options.projectId,
        }),
      ),
    queryKey: queryKeys.pushNotificationSend.list(options),
  });

export const getPushNotificationSendDeliveriesOptions = (options: {
  projectId: string;
  sendId: string;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetPushNotificationSendDeliveries(options)),
    queryKey: queryKeys.pushNotificationSend.deliveries(options),
  });
