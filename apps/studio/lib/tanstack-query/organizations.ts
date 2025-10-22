import { Effect } from 'effect';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const createOrganizationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createOrganization',
    mutationFn: (variables: { name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.CreateOrganization(variables))
      )
  });

export const updateOrganizationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'updateOrganization',
    mutationFn: (variables: { organizationId: string; name: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.UpdateOrganization(variables))
      )
  });

export const deleteOrganizationOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deleteOrganization',
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) => rpc.DeleteOrganization(variables))
      )
  });
