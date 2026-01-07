import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  ProjectNotFoundError,
  ProjectServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";
import { _deleteProjectRecord, _getProjectById } from "./utils";

export const deleteProject = Effect.gen(function* deleteProject() {
  const db = yield* Db;
  return Effect.fn("deleteProject")(
    function* deleteProject(input: { id: string }) {
      const session = yield* AuthSession;

      // First check if project exists
      const project = yield* _getProjectById(db)(input.id);
      if (!project) {
        return yield* Effect.fail(
          new ProjectNotFoundError({
            projectId: input.id,
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.id,
        "project:all",
        `User ${session?.user?.id} is not authorized to delete project ${input.id}`
      );

      // Delete the project
      yield* _deleteProjectRecord(db)(input.id);

      yield* Effect.log(`Deleted project ${input.id}`);

      return yield* Effect.void;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new ProjectServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
