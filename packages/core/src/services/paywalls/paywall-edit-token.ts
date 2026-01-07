import {
  and,
  eq,
  gt,
  type InsertPaywallEditToken,
  paywallEditTokens,
  paywalls
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PaywallNotFoundError,
  PaywallServiceError
} from '@voidhash/shared';
import { Effect } from 'effect';
import { checkProjectPermission } from '../../utils/permissions';

const TOKEN_EXPIRY_MINUTES = 5;

const _createTokenRecord = (db: Db) =>
  db.makeQuery((execute, token: InsertPaywallEditToken) =>
    execute(async (db) => await db.insert(paywallEditTokens).values(token))
  );

const _getPaywallById = (db: Db) =>
  db.makeQuery((execute, paywallId: string) =>
    execute(
      async (db) =>
        await db.query.paywalls.findFirst({
          where: eq(paywalls.id, paywallId)
        })
    )
  );

const _getValidToken = (db: Db) =>
  db.makeQuery((execute, token: string) =>
    execute(
      async (db) =>
        await db.query.paywallEditTokens.findFirst({
          where: and(
            eq(paywallEditTokens.token, token),
            gt(paywallEditTokens.expiresAt, new Date())
          )
        })
    )
  );

export const createEditToken = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('createEditToken')(
    function* (paywallId: string) {
      const session = yield* AuthSession;

      // Fetch paywall to get projectId
      const paywall = yield* _getPaywallById(db)(paywallId);
      if (!paywall) {
        return yield* Effect.fail(
          new PaywallNotFoundError({
            message: `Paywall not found: ${paywallId}`
          })
        );
      }

      // SECURITY: Authorization check
      yield* checkProjectPermission(
        paywall.projectId,
        'project:all',
        `User ${session?.user?.id} is not authorized to edit paywall ${paywallId}`
      );

      // Generate secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      const newToken: InsertPaywallEditToken = {
        id: generateId('paywallEditToken'),
        token,
        paywallId,
        userId: session?.user?.id ?? '',
        expiresAt
      };

      yield* _createTokenRecord(db)(newToken);
      yield* Effect.log(
        `Created edit token for paywall ${paywallId}, expires at ${expiresAt.toISOString()}`
      );

      return {
        token,
        expiresAt
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

export const validateEditToken = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('validateEditToken')(
    function* (token: string) {
      const tokenRecord = yield* _getValidToken(db)(token);

      if (!tokenRecord) {
        return null;
      }

      return {
        userId: tokenRecord.userId,
        paywallId: tokenRecord.paywallId
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
