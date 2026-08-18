import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const getEventAdmissionPolicyOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) => rpc.GetEventAdmissionPolicy({ projectId: options.projectId })),
    queryKey: queryKeys.eventAdmission.policy(options),
  });

export const setBuiltinEventAdmissionOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; key: string; enabled: boolean }) =>
      VoidhashRpc.request((rpc) => rpc.SetBuiltinEventAdmission(variables)),
    mutationKey: ["setBuiltinEventAdmission"],
  });

export const setCustomEventBlockedOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; eventName: string; blocked: boolean }) =>
      VoidhashRpc.request((rpc) => rpc.SetCustomEventBlocked(variables)),
    mutationKey: ["setCustomEventBlocked"],
  });
