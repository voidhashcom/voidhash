import { RpcClient } from "effect/unstable/rpc";

import { VoidhashRpc, eq } from "../effect-query";

export const getDevelopmentModeSettingsOptions = (projectId: string) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc
          .GetDevelopmentModeSettings({ projectId })
          .pipe(RpcClient.withHeaders({ "x-environment": "development" })),
      ),
    queryKey: ["development-mode", "settings", projectId],
  });

export const getDevelopmentModeStateOptions = (options: { personId: string; projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc
          .GetDevelopmentModeState(options)
          .pipe(RpcClient.withHeaders({ "x-environment": "development" })),
      ),
    queryKey: ["development-mode", "person", options.projectId, options.personId],
  });

export const applyDevelopmentLifecycleActionOptions = () =>
  eq.mutationOptions({
    mutationFn: (input: {
      action: "expire" | "revoke" | "renew" | "refund" | "grace_period";
      actionId: string;
      projectId: string;
      targetId: string;
      targetType: "subscription" | "purchase";
    }) =>
      VoidhashRpc.request((rpc) =>
        rpc
          .ApplyDevelopmentLifecycleAction(input)
          .pipe(RpcClient.withHeaders({ "x-environment": "development" })),
      ),
    mutationKey: ["development-mode", "lifecycle"],
  });

export const setDevelopmentPurchasesEnabledOptions = () =>
  eq.mutationOptions({
    mutationFn: (input: { enabled: boolean; projectId: string }) =>
      VoidhashRpc.request((rpc) =>
        rpc
          .SetDevelopmentPurchasesEnabled({
            isEnabled: input.enabled,
            projectId: input.projectId,
          })
          .pipe(RpcClient.withHeaders({ "x-environment": "development" })),
      ),
    mutationKey: ["development-mode", "enabled"],
  });

export const resetDevelopmentDataOptions = () =>
  eq.mutationOptions({
    mutationFn: (input: { projectId: string }) =>
      VoidhashRpc.request((rpc) =>
        rpc
          .ResetDevelopmentData(input)
          .pipe(RpcClient.withHeaders({ "x-environment": "development" })),
      ),
    mutationKey: ["development-mode", "reset"],
  });
