import { ActionForbiddenError, type AnyAuthSession } from '@voidhash/shared';
import { Effect } from 'effect';

export const extractAuthorizedProjectId = (authSession: AnyAuthSession) =>
  Effect.gen(function* () {
    const projectId = authSession.projects[0]?.id;
    if (!projectId) {
      return yield* Effect.fail(
        new ActionForbiddenError({
          message: 'No project found for this authentication method.'
        })
      );
    }
    return projectId;
  });
