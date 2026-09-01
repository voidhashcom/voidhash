import * as Arr from "effect/Array";
import type { OrganizationPermission, ProjectPermission } from "@voidhash/lib";
import * as Effect from "effect/Effect";

import { ActionForbiddenError, type AnyAuthSession, AuthSession } from "../domain/auth/Auth.ts";

/**
 * Resolve the project the caller is acting on from the active session. API
 * keys and publishable/secret keys carry exactly one project; for user
 * sessions we surface the first project since these endpoints today don't
 * accept an explicit project id. Fails with `ActionForbiddenError` when no
 * project is in scope.
 */
export const extractAuthorizedProjectId = (authSession: AnyAuthSession) =>
  Effect.gen(function* () {
    const projectId = authSession.projects[0]?.id;
    if (!projectId) {
      return yield* Effect.fail(
        new ActionForbiddenError({
          message: "No project found for this authentication method.",
        }),
      );
    }
    return projectId;
  });

/**
 * Resolve the project an HTTP request targets, preferring an explicit id.
 *
 * Key-based sessions carry exactly one project, so omitting the id is
 * unambiguous and stays backwards compatible. A user session may span many
 * projects: there `extractAuthorizedProjectId`'s "first project" fallback picks
 * an arbitrary tenant, so we require the caller to name one instead of guessing.
 *
 * @param session - the authenticated session
 * @param requested - `projectId` from the query string or body, if supplied
 */
export const resolveRequestProjectId = (session: AnyAuthSession, requested?: string) =>
  Effect.gen(function* () {
    if (requested !== undefined) {
      const match = session.projects.find((p) => p.id === requested);
      if (!match) {
        return yield* Effect.fail(
          new ActionForbiddenError({
            message: "The authenticated credential does not have access to this project.",
          }),
        );
      }
      return match.id;
    }

    const onlyProject = session.projects[0];
    if (session.projects.length === 1 && onlyProject) {
      return onlyProject.id;
    }

    if (Arr.isReadonlyArrayEmpty(session.projects)) {
      return yield* Effect.fail(
        new ActionForbiddenError({
          message: "No project found for this authentication method.",
        }),
      );
    }

    return yield* Effect.fail(
      new ActionForbiddenError({
        message: "This credential spans multiple projects; specify a projectId.",
      }),
    );
  });

/**
 * Whether the session is a member of `organizationId`. Any org that appears in
 * the session is one the caller belongs to — the least-privileged check (no
 * specific permission required), for org-scoped features every member may use
 * (e.g. the asset library and agent attachments). Pure over the session, so it is
 * unit-testable without a live session.
 */
export const isSessionOrganizationMember = (
  session: AnyAuthSession,
  organizationId: string,
): boolean => session.organizations.some((o) => o.id === organizationId);

/**
 * Whether the session has access to `projectId` under `organizationId`. The
 * org match guards against trusting a project id spoofed from the request body.
 */
export const isSessionProjectMember = (
  session: AnyAuthSession,
  projectId: string,
  organizationId: string,
): boolean =>
  session.projects.some((p) => p.id === projectId && p.organizationId === organizationId);

export const checkProjectPermission = (
  projectId: string,
  permission: ProjectPermission,
  message: string,
) =>
  Effect.gen(function* () {
    const session = yield* AuthSession;
    const hasPermission =
      session?.projects.some((p) => p.id === projectId && p.permissions.includes(permission)) ??
      false;
    return yield* processPermissionCheck(hasPermission, message);
  });

export const checkOrganizationPermission = (
  organizationId: string,
  permission: OrganizationPermission,
  message: string,
) =>
  Effect.gen(function* () {
    const session = yield* AuthSession;
    const hasPermission =
      session?.organizations.some(
        (o) => o.id === organizationId && o.permissions.includes(permission),
      ) ?? false;
    return yield* processPermissionCheck(hasPermission, message);
  });

const processPermissionCheck = (hasPermission: boolean, message: string) =>
  Effect.gen(function* () {
    if (!hasPermission) {
      yield* Effect.logWarning(message);
      return yield* Effect.fail(new ActionForbiddenError({ message }));
    }
    return true;
  });
