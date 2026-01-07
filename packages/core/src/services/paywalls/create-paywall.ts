import { and, eq, type InsertPaywall, paywalls } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaywallServiceError,
  PaywallSlugAlreadyExistsError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const _createPaywallRecord = (db: Db) =>
  db.makeQuery((execute, paywall: InsertPaywall) =>
    execute(async (db) => await db.insert(paywalls).values(paywall))
  );

const _getPaywallBySlug = (db: Db) =>
  db.makeQuery((execute, input: { slug: string; projectId: string }) =>
    execute(
      async (db) =>
        await db.query.paywalls.findFirst({
          where: and(
            eq(paywalls.slug, input.slug),
            eq(paywalls.projectId, input.projectId)
          )
        })
    )
  );

export const createPaywall = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createPaywall')(
    function* (input: { projectId: string; name: string; slug: string }) {
      const session = yield* AuthSession;

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        input.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to create paywalls for project ${input.projectId}`
      );

      const paywall = yield* _getPaywallBySlug(db)({
        slug: input.slug,
        projectId: input.projectId
      });
      if (paywall) {
        return yield* Effect.fail(
          new PaywallSlugAlreadyExistsError({
            slug: input.slug
          })
        );
      }

      const newPaywall = {
        id: generateId('paywall'),
        slug: input.slug,
        projectId: input.projectId,
        name: input.name
      };

      yield* _createPaywallRecord(db)(newPaywall);
      yield* Effect.log(
        `Created paywall ${newPaywall.id} for project ${input.projectId}`
      );

      return {
        id: newPaywall.id
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new PaywallServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
