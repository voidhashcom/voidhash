import { Effect } from "effect";

import { VoidhashRpc, eq } from "../effect-query";

export const createOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateOrganization(variables))
      ),
    mutationKey: ["createOrganization"],
  });

export const updateOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string; name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.UpdateOrganization(variables))
      ),
    mutationKey: ["updateOrganization"],
  });

export const deleteOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteOrganization(variables))
      ),
    mutationKey: ["deleteOrganization"],
  });
