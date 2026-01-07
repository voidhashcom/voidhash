import { eq, paywalls } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  PaywallNotFoundError,
  PaywallServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { checkProjectPermission } from "../../utils/permissions";

const _getPaywallById = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(
      async (db) =>
        await db.query.paywalls.findFirst({ where: eq(paywalls.id, id) })
    )
  );

const _deletePaywallRecord = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => db.delete(paywalls).where(eq(paywalls.id, id)))
  );

export const deletePaywall = Effect.gen(function* deletePaywall() {
  const db = yield* Db;
  return Effect.fn("deletePaywall")(
    function* deletePaywall(input: { paywallId: string }) {
      const session = yield* AuthSession;
      const paywall = yield* _getPaywallById(db)(input.paywallId);
      if (!paywall) {
        return yield* Effect.fail(
          new PaywallNotFoundError({
            message: `Paywall with id ${input.paywallId} not found`,
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        paywall.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to delete paywall ${input.paywallId}`
      );

      yield* _deletePaywallRecord(db)(input.paywallId);
      yield* Effect.log(`Deleted paywall ${input.paywallId}`);
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaywallServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
