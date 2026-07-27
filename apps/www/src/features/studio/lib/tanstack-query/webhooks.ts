import { Effect } from "effect";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries
export const listWebhookEndpointsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListWebhookEndpoints(options)),
    queryKey: queryKeys.webhook.list(options),
  });

export const getWebhookEndpointOptions = (options: { endpointId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetWebhookEndpoint(options)),
    queryKey: queryKeys.webhook.getEndpoint(options.endpointId),
  });

export const listWebhookDeliveriesOptions = (options: { projectId: string; endpointId?: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListWebhookDeliveries(options)),
    queryKey: queryKeys.webhook.deliveries(options),
  });

export const getWebhookDeliveryOptions = (options: { deliveryId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetWebhookDelivery(options)),
    queryKey: queryKeys.webhook.getDelivery(options.deliveryId),
  });

// Mutations
export const createWebhookEndpointOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      name: string;
      url: string;
      events: string[];
      description?: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreateWebhookEndpoint(variables)),
    mutationKey: ["createWebhookEndpoint"],
  });

export const updateWebhookEndpointOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      endpointId: string;
      name?: string;
      url?: string;
      events?: string[];
      status?: "active" | "disabled";
      description?: string | null;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateWebhookEndpoint(variables)),
    mutationKey: ["updateWebhookEndpoint"],
  });

export const deleteWebhookEndpointOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { endpointId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteWebhookEndpoint(variables)),
    mutationKey: ["deleteWebhookEndpoint"],
  });

export const rotateWebhookSecretOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { endpointId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RotateWebhookSecret(variables)),
    mutationKey: ["rotateWebhookSecret"],
  });

export const testWebhookEndpointOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { endpointId: string }) =>
      VoidhashRpc.request((rpc) => rpc.TestWebhookEndpoint(variables)),
    mutationKey: ["testWebhookEndpoint"],
  });

export const retryWebhookDeliveryOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { deliveryId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RetryWebhookDelivery(variables)),
    mutationKey: ["retryWebhookDelivery"],
  });
