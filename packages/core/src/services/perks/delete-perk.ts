import { eq, perks } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PerkNotFoundError,
  PerkServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getPerkById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) => await db.query.perks.findFirst({ where: eq(perks.id, id) })
    )
  );

const _deletePerkRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => db.delete(perks).where(eq(perks.id, id)))
  );

export const deletePerk = Effect.gen(function* deletePerk() {
  const db = yield* Db;
  return Effect.fn("deletePerk")(
    function* deletePerk(input: { perkId: string }) {
      const session = yield* AuthSession;
      const perk = yield* _getPerkById(db)(input.perkId);
      if (!perk) {
        return yield* Effect.fail(
          new PerkNotFoundError({
            message: `Perk with id ${input.perkId} not found`,
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        perk.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to delete perk ${input.perkId}`
      );

      yield* _deletePerkRecord(db)(input.perkId);
      yield* Effect.log(`Deleted perk ${input.perkId}`);
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
