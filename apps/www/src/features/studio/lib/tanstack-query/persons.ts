import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPersonsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPersons({ projectId: options.projectId })),
    queryKey: queryKeys.person.list(options.projectId),
  });

export const getPersonByDistinctIdOptions = (options: { projectId: string; distinctId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) =>
        rpc.GetPersonByDistinctId({
          distinctId: options.distinctId,
          projectId: options.projectId,
        }),
      ),
    queryKey: queryKeys.person.getPersonByDistinctId(options.projectId, options.distinctId),
  });

export const createPersonOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      distinctId: string;
      name?: string;
      email?: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreatePerson(variables)),
    mutationKey: ["createPerson"],
  });
