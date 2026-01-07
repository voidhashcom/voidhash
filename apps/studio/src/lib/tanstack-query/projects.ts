import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listProjectsOptions = (options: { organizationId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListProjects({ organizationId: options.organizationId })
        )
      ),
    queryKey: queryKeys.project.list(options),
  });

export const createProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string; organizationId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateProject(variables))),
    mutationKey: ["createProject"],
  });

export const updateProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.UpdateProject(variables))),
    mutationKey: ["updateProject"],
  });

export const deleteProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteProject(variables))),
    mutationKey: ["deleteProject"],
  });
