import { Db } from "@voidhash/db/effect";
import { AuthSession, ProjectServiceError } from "@voidhash/shared";
import { Effect } from "effect";

import { checkOrganizationPermission } from "../../utils/permissions";
import { _getProjectsByOrganizationId } from "./utils";

export const getProjects = Effect.gen(function* getProjects() {
  const db = yield* Db;
  return Effect.fn("getProjects")(
    function* getProjects(organizationId: string) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        organizationId,
        "organization:all",
        `User ${session?.user?.id} is not authorized to access projects for organization ${organizationId}`
      );

      return yield* _getProjectsByOrganizationId(db)(organizationId);
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
