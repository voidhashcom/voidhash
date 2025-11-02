import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listProjectsOptions = (options: { organizationId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.project.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListProjects({ organizationId: options.organizationId })
        )
      )
  });

export const createProjectOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createProject'],
    mutationFn: (variables: { name: string; organizationId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProject(variables)))
  });

export const updateProjectOptions = () =>
  eq.mutationOptions({
    mutationKey: ['updateProject'],
    mutationFn: (variables: { id: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProject(variables)))
  });

export const deleteProjectOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deleteProject'],
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProject(variables)))
  });
