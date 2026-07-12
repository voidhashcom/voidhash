import type { AnyAuthSession } from "../../domain/auth/Auth.ts";

const ELEVATED_PERMISSION = "project:all";

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
  projects: session.projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          permissions: project.permissions.includes(ELEVATED_PERMISSION)
            ? project.permissions
            : [...project.permissions, ELEVATED_PERMISSION],
        }
      : project,
  ),
});
