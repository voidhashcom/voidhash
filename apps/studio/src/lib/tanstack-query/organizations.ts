import { Effect } from 'effect';
import { eq, VoidhashRpc } from '../effect-query';

export const createOrganizationOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createOrganization'],
    mutationFn: (variables: { name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateOrganization(variables))
      )
  });

export const updateOrganizationOptions = () =>
  eq.mutationOptions({
    mutationKey: ['updateOrganization'],
    mutationFn: (variables: { organizationId: string; name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.UpdateOrganization(variables))
      )
  });

export const deleteOrganizationOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deleteOrganization'],
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteOrganization(variables))
      )
  });
