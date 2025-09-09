import type { OrganizationPermission, ProjectPermission } from '@voidhash/lib';
import { Effect } from 'effect';
import { ActionForbiddenError } from '../services';
import { AuthSession } from '../services/auth-service';

export const checkProjectPermission = (
  projectId: string,
  permission: ProjectPermission,
  message: string
) =>
  Effect.gen(function* () {
    const session = yield* AuthSession;
    const hasPermission = session?.projects.some(
      (p) => p.id === projectId && p.permissions.includes(permission)
    );
    return yield* processPermissionCheck(hasPermission, message);
  });

export const checkOrganizationPermission = (
  organizationId: string,
  permission: OrganizationPermission,
  message: string
) =>
  Effect.gen(function* () {
    const session = yield* AuthSession;
    const hasPermission = session?.organizations.some(
      (o) => o.id === organizationId && o.permissions.includes(permission)
    );
    return yield* processPermissionCheck(hasPermission, message);
  });

const processPermissionCheck = (hasPermission: boolean, message: string) =>
  Effect.gen(function* () {
    if (!hasPermission) {
      yield* Effect.logWarning(message);
      return yield* Effect.fail(
        new ActionForbiddenError({
          message
        })
      );
    }
    return yield* Effect.succeed(true);
  });
