import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listProjectsOptions = (options: { organizationId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.project.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListProjects({ organizationId: options.organizationId })
        )
      )
  });

export const createProjectOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createProject',
    mutationFn: (variables: { name: string; organizationId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProject(variables)))
  });

export const updateProjectOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'updateProject',
    mutationFn: (variables: { id: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProject(variables)))
  });

export const deleteProjectOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deleteProject',
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProject(variables)))
  });
