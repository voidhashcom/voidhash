import { and, eq, perks } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PerkServiceError,
  PerkSlugAlreadyExistsError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getPerkBySlug = (db: Db) =>
  db.makeQuery((execute, input: { slug: string; projectId: string }) =>
    execute(
      async (db) =>
        await db.query.perks.findFirst({
          where: and(
            eq(perks.slug, input.slug),
            eq(perks.projectId, input.projectId)
          ),
        })
    )
  );

const _updatePerkRecord = (db: Db) =>
  db.makeQuery((execute, input: { id: string; name: string; slug: string }) =>
    execute(
      async (db) =>
        await db
          .update(perks)
          .set({ name: input.name, slug: input.slug })
          .where(eq(perks.id, input.id))
    )
  );

export const updatePerk = Effect.gen(function* updatePerk() {
  const db = yield* Db;
  return Effect.fn("updatePerk")(
    function* updatePerk(input: {
      id: string;
      projectId: string;
      name: string;
      slug: string;
    }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to update perks for project ${input.projectId}`
      );

      // Check if slug is already taken by another perk
      const existingPerk = yield* _getPerkBySlug(db)({
        projectId: input.projectId,
        slug: input.slug,
      });

      if (existingPerk && existingPerk.id !== input.id) {
        return yield* Effect.fail(
          new PerkSlugAlreadyExistsError({
            slug: input.slug,
          })
        );
      }

      yield* _updatePerkRecord(db)(input);

      yield* Effect.log(
        `Updated perk ${input.id} for project ${input.projectId}`
      );

      return {
        id: input.id,
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
