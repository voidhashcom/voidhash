import { Db } from "@voidhash/db/effect";
import { AuthSession, ProjectServiceError } from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";
import { _getProjectById } from "./utils";

export const getProjectById = Effect.gen(function* getProjectById() {
  const db = yield* Db;
  return Effect.fn("getProjectById")(
    function* getProjectById(id: string) {
      const session = yield* AuthSession;
      const project = yield* _getProjectById(db)(id);
      if (!project) {
        return null;
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        id,
        "project:all",
        `User ${session?.user?.id} is not authorized to access project ${id}`
      );

      return project;
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
