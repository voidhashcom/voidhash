import type { AnyAuthSession } from "../../domain/auth/Auth.ts";

const ELEVATED_PERMISSION = "project:all";

/** Adds the elevated permission when absent, leaving an already-elevated list as-is. */
const elevatedPermissions = (permissions: ReadonlyArray<string>): ReadonlyArray<string> => {
  if (permissions.includes(ELEVATED_PERMISSION)) return permissions;
  return [...permissions, ELEVATED_PERMISSION];
};

/**
 * Returns a copy of `session` with `project:all` added to the permissions of
 * the project whose id matches `projectId`. The input is not mutated.
 *
 * Used when `SdkService` delegates to services that gate on `project:all`
 * (`PerkGrantService.getPersonUnlockedPerks`, `PurchaseService.getPersonPurchases`).
 * The SDK's publishable-key session carries `project:read` only, but the
 * publishable-key auth has already been validated upstream by
 * `bridgeAuthSession` against the requested project, so it is safe to elevate
 * the session for the duration of the delegated call.
 */
export const elevateProjectAccess = (
  session: AnyAuthSession,
  projectId: string,
): AnyAuthSession => ({
  ...session,
  projects: session.projects.map((project) => {
    if (project.id !== projectId) return project;
    return { ...project, permissions: elevatedPermissions(project.permissions) };
  }),
});
