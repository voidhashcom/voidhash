import {
  PurchaseLedgerClaimedRow,
  PurchaseLedgerStore,
  PurchasePortError,
} from "@voidhash/core-v2";
import {
  Db,
  PurchaseLedgerStatus,
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  purchaseLedger,
  sql,
} from "@voidhash/db";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Effect, Layer, Schema } from "effect";

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

/**
 * Compare-and-set guard for terminal transitions: the row must still be
 * `InProgress` and held by the caller's claim token. A stale worker whose
 * claim was released and reclaimed matches zero rows instead of
 * double-publishing or overwriting the new claimant's state.
 */
const ownedClaim = (input: { readonly id: string; readonly claimedBy: string }) =>
  and(
    eq(purchaseLedger.id, input.id),
    eq(purchaseLedger.claimedBy, input.claimedBy),
    eq(purchaseLedger.status, PurchaseLedgerStatus.InProgress),
  );

export const DbPurchaseLedgerStoreLive = Layer.effect(
  PurchaseLedgerStore,
  Effect.gen(function* () {
    const db = yield* Db;

    return PurchaseLedgerStore.of({
      claim: (options) =>
        db
          .transaction((tx) =>
            Effect.gen(function* () {
              const workerId = generateId("purchaseLedger");
              const releasedRows = yield* tx
                .update(purchaseLedger)
                .set({
                  claimedAt: null,
                  claimedBy: null,
                  status: PurchaseLedgerStatus.Pending,
                })
                .where(
                  and(
                    eq(purchaseLedger.status, PurchaseLedgerStatus.InProgress),
                    lte(
                      purchaseLedger.claimedAt,
                      sql`(NOW() - ${options.staleClaimSeconds} * INTERVAL '1 second')`,
                    ),
                  ),
                )
                .returning({ id: purchaseLedger.id });

              const candidates = yield* tx
                .select({ id: purchaseLedger.id })
                .from(purchaseLedger)
                .where(
                  and(
                    eq(purchaseLedger.status, PurchaseLedgerStatus.Pending),
                    or(
                      isNull(purchaseLedger.nextAttemptAt),
                      lte(purchaseLedger.nextAttemptAt, sql`NOW()`),
                    ),
                  ),
                )
                .orderBy(asc(purchaseLedger.createdAt))
                .limit(options.batchSize)
                .for("update", { skipLocked: true });

              if (candidates.length > 0) {
                yield* tx
                  .update(purchaseLedger)
                  .set({
                    claimedAt: sql`NOW()`,
                    claimedBy: workerId,
                    status: PurchaseLedgerStatus.InProgress,
                  })
                  .where(
                    and(
                      eq(purchaseLedger.status, PurchaseLedgerStatus.Pending),
                      inArray(
                        purchaseLedger.id,
                        candidates.map((candidate) => candidate.id),
                      ),
                    ),
                  );
              }

              const claimed = yield* tx.query.purchaseLedger.findMany({
                where: {
                  claimedBy: workerId,
                  status: PurchaseLedgerStatus.InProgress,
                },
              });
              const rows = yield* Schema.decodeUnknownEffect(
                Schema.Array(PurchaseLedgerClaimedRow),
              )(claimed);
              return { rows, staleClaimsReleased: releasedRows.length };
            }),
          )
          .pipe(Effect.mapError(portError("failed to claim purchase ledger rows"))),

      deadLetter: (input) =>
        db
          .update(purchaseLedger)
          .set({
            attemptCount: input.attemptCount,
            claimedAt: null,
            claimedBy: null,
            lastError: input.lastError,
            status: PurchaseLedgerStatus.DeadLetter,
          })
          .where(ownedClaim(input))
          .pipe(
            Effect.asVoid,
            Effect.mapError(portError("failed to dead-letter a purchase ledger row")),
          ),

      publish: (input) =>
        db
          .update(purchaseLedger)
          .set({
            claimedAt: null,
            claimedBy: null,
            lastError: null,
            publishedAt: sql`NOW()`,
            status: PurchaseLedgerStatus.Published,
          })
          .where(ownedClaim(input))
          .pipe(
            Effect.asVoid,
            Effect.mapError(portError("failed to publish a purchase ledger row")),
          ),

      retry: (input) =>
        db
          .update(purchaseLedger)
          .set({
            attemptCount: input.attemptCount,
            claimedAt: null,
            claimedBy: null,
            lastError: input.lastError,
            nextAttemptAt: sql`(NOW() + ${input.backoffSeconds} * INTERVAL '1 second')`,
            status: PurchaseLedgerStatus.Pending,
          })
          .where(ownedClaim(input))
          .pipe(Effect.asVoid, Effect.mapError(portError("failed to retry a purchase ledger row"))),
    });
  }),
);
