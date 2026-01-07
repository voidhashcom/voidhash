import { type InsertPerk, and, eq, perks } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
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

const _createPerkRecord = (db: Db) =>
  db.makeQuery((execute, perk: InsertPerk) =>
    execute(async (db) => await db.insert(perks).values(perk))
  );

export const createPerk = Effect.gen(function* createPerk() {
  const db = yield* Db;
  return Effect.fn("createPerk")(
    function* createPerk(input: {
      projectId: string;
      name: string;
      slug: string;
    }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to create perks for project ${input.projectId}`
      );

      const perk = yield* _getPerkBySlug(db)({
        projectId: input.projectId,
        slug: input.slug,
      });
      if (perk) {
        return yield* Effect.fail(
          new PerkSlugAlreadyExistsError({
            slug: input.slug,
          })
        );
      }

      const newPerk = {
        id: generateId("perk"),
        name: input.name,
        projectId: input.projectId,
        slug: input.slug,
      };

      yield* _createPerkRecord(db)(newPerk);
      yield* Effect.log(
        `Created perk ${newPerk.id} for project ${input.projectId}`
      );

      // TODO: Adding a perk should unlock it for existing users?

      return {
        id: newPerk.id,
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
