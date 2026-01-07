import { Db, TransactionContext } from "@voidhash/db/effect";
import {
  SLUG_BLACKLIST,
  createShortId,
  createSlug,
  generateId,
} from "@voidhash/lib";
import {
  AuthSession,
  AuthenticationError,
  ProjectServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { createPublishableKey } from "../../utils/api-keys/effect/utils";
import { checkOrganizationPermission } from "../../utils/permissions";
import {
  _createApiKeyRecord,
  _createProjectRecord,
  _getProjectBySlug,
} from "./utils";

export const createProject = Effect.gen(function* createProject() {
  const db = yield* Db;
  return Effect.fn("createProject")(
    function* createProject(input: { name: string; organizationId: string }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkOrganizationPermission(
        input.organizationId,
        "organization:all",
        `User ${session?.user?.id} is not authorized to create projects for organization ${input.organizationId}`
      );

      const userId = session?.user?.id;
      if (!userId) {
        return yield* Effect.fail(
          new AuthenticationError({
            cause: "You are not authenticated",
            message: "You are not authenticated",
          })
        );
      }

      const id = generateId("project");
      let slug = createSlug(input.name);

      if (SLUG_BLACKLIST.includes(slug)) {
        slug = `${slug}-${createShortId()}`;
      }

      const existingProject = yield* _getProjectBySlug(db)({
        organizationId: input.organizationId,
        projectSlug: slug,
      });

      if (existingProject) {
        slug = `${slug}-${createShortId()}`;
      }

      yield* db.transaction((tx) =>
        TransactionContext.provide(tx)(
          Effect.gen(function* createProject() {
            yield* _createProjectRecord(db)({
              createdByUserId: userId,
              id,
              name: input.name,
              organizationId: input.organizationId,
              slug,
            });

            // Create production publishable key
            const productionPublishableKey = yield* createPublishableKey();
            yield* _createApiKeyRecord(db)({
              id: generateId("apiPublishableKey"),
              projectId: id,
              name: "Publishable key",
              ...productionPublishableKey,
            });
          })
        )
      );

      yield* Effect.log(
        `Created project ${id} for organization ${input.organizationId}`
      );

      return yield* Effect.succeed({
        id,
        name: input.name,
        slug,
      });
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
