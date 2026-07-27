import type { QueryClient } from "@tanstack/react-query";
import { INTERNAL_FEATURE_FLAG_LIST, type User } from "@voidhash/rpc";

import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

interface CreatedOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

/**
 * The flags a brand-new organization resolves to: it has no overrides yet, so
 * the server will report exactly the flags whose code default is on. Seeding
 * these keeps the optimistic entry honest for gates that must not be bypassed
 * — notably the waitlist, which would otherwise let a new organization into
 * Studio until the next `CurrentUser` refetch.
 */
const DEFAULT_ENABLED_INTERNAL_FEATURE_FLAGS = INTERNAL_FEATURE_FLAG_LIST.filter(
  (flag) => flag.defaultEnabled,
).map((flag) => flag.key);

/** Adds a newly created organization to the cached current-user session. */
export const addCreatedOrganizationToCurrentUserCache = (
  queryClient: QueryClient,
  createdOrganization: CreatedOrganization,
) => {
  queryClient.setQueryData<typeof User.Type>(queryKeys.user.getUser(), (previous) => {
    if (!previous) {
      return previous;
    }

    const alreadyCached = previous.organizations.some(
      (organization) =>
        organization.id === createdOrganization.id ||
        organization.slug === createdOrganization.slug,
    );

    if (alreadyCached) {
      return previous;
    }

    return {
      ...previous,
      organizations: [
        ...previous.organizations,
        {
          id: createdOrganization.id,
          logo: null,
          name: createdOrganization.name,
          slug: createdOrganization.slug,
          workosOrganizationId: null,
          internalFeatureFlags: DEFAULT_ENABLED_INTERNAL_FEATURE_FLAGS,
        },
      ],
    };
  });
};

export const createOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateOrganization(variables)),
    mutationKey: ["createOrganization"],
  });

export const updateOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string; name: string }) =>
      VoidhashRpc.request((rpc) => rpc.UpdateOrganization(variables)),
    mutationKey: ["updateOrganization"],
  });

export const deleteOrganizationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteOrganization(variables)),
    mutationKey: ["deleteOrganization"],
  });

export const setOrganizationAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string; imageBase64: string; contentType: string }) =>
      VoidhashRpc.request((rpc) => rpc.SetOrganizationAvatar(variables)),
    mutationKey: ["setOrganizationAvatar"],
  });

export const removeOrganizationAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RemoveOrganizationAvatar(variables)),
    mutationKey: ["removeOrganizationAvatar"],
  });
