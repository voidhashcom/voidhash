import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@voidhash/rpc";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

interface CreatedProject {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly slug: string;
}

/** Adds a newly created project to the cached current-user session. */
export const addCreatedProjectToCurrentUserCache = (
  queryClient: QueryClient,
  createdProject: CreatedProject,
) => {
  queryClient.setQueryData<typeof User.Type>(queryKeys.user.getUser(), (previous) => {
    if (!previous) {
      return previous;
    }

    const alreadyCached = previous.projects.some(
      (project) =>
        project.id === createdProject.id ||
        (project.organizationId === createdProject.organizationId &&
          project.slug === createdProject.slug),
    );

    if (alreadyCached) {
      return previous;
    }

    return {
      ...previous,
      projects: [
        ...previous.projects,
        {
          id: createdProject.id,
          logo: null,
          name: createdProject.name,
          organizationId: createdProject.organizationId,
          slug: createdProject.slug,
        },
      ],
    };
  });
};

export const listProjectsOptions = (options: { organizationId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.request((rpc) => rpc.ListProjects({ organizationId: options.organizationId })),
    queryKey: queryKeys.project.list(options),
  });

export const createProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string; organizationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateProject(variables)),
    mutationKey: ["createProject"],
  });

export const updateProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; name: string }) =>
      VoidhashRpc.request((rpc) => rpc.UpdateProject(variables)),
    mutationKey: ["updateProject"],
  });

export const deleteProjectOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteProject(variables)),
    mutationKey: ["deleteProject"],
  });

export const setProjectAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; imageBase64: string; contentType: string }) =>
      VoidhashRpc.request((rpc) => rpc.SetProjectAvatar(variables)),
    mutationKey: ["setProjectAvatar"],
  });

export const removeProjectAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.RemoveProjectAvatar(variables)),
    mutationKey: ["removeProjectAvatar"],
  });
