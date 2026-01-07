import type { User } from "@voidhash/rpc";

function getProjectBySlugs(
  currentUser: typeof User.Type,
  organizationSlug: string,
  projectSlug: string
) {
  const organization = currentUser.organizations.find(
    (o) => o.slug === organizationSlug
  );
  if (!organization) {
    return null;
  }
  return currentUser.projects.find(
    (p) => p.slug === projectSlug && p.organizationId === organization.id
  );
}

export const CurrentUser = {
  getProjectBySlugs,
} as const;
