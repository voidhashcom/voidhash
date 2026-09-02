import {
  MAX_PURCHASE_LEDGER_REQUEUE_IDS,
  PurchaseLedgerClaimedRow,
  PurchaseLedgerDeadLetterRow,
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
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";

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
            Effect.fn("claim")(function* () {
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

              if (Arr.isReadonlyArrayNonEmpty(candidates)) {
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
            })(),
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
            updatedAt: sql`NOW()`,
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

      listDeadLetters: (input) =>
        Effect.fn("listDeadLetters")(function* () {
          const rows = yield* db
            .select({
              attemptCount: purchaseLedger.attemptCount,
              createdAt: purchaseLedger.createdAt,
              eventsPayload: purchaseLedger.eventsPayload,
              id: purchaseLedger.id,
              lastError: purchaseLedger.lastError,
              organizationId: purchaseLedger.organizationId,
              personId: purchaseLedger.personId,
              projectId: purchaseLedger.projectId,
              providerEventType: purchaseLedger.providerEventType,
              providerId: purchaseLedger.providerId,
              rawProviderPayload: purchaseLedger.rawProviderPayload,
              source: purchaseLedger.source,
            })
            .from(purchaseLedger)
            .where(eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter))
            .orderBy(asc(purchaseLedger.createdAt))
            .limit(input.limit)
            .offset(input.offset);
          const totals = yield* db
            .select({ count: sql<number>`count(*)` })
            .from(purchaseLedger)
            .where(eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter));
          return {
            items: yield* Schema.decodeUnknownEffect(Schema.Array(PurchaseLedgerDeadLetterRow))(
              rows,
            ),
            total: Number(totals[0]?.count ?? 0),
          };
        })().pipe(Effect.mapError(portError("failed to list dead-lettered purchase ledger rows"))),

      requeueDeadLetters: ({ ids }) => {
        if (Arr.isReadonlyArrayEmpty(ids)) return Effect.succeed(0);
        if (ids.length > MAX_PURCHASE_LEDGER_REQUEUE_IDS) {
          return Effect.fail(
            new PurchasePortError({
              cause: ids.length,
              message: `cannot requeue more than ${MAX_PURCHASE_LEDGER_REQUEUE_IDS} purchase ledger rows at once`,
            }),
          );
        }
        return db
          .update(purchaseLedger)
          .set({
            attemptCount: 0,
            claimedAt: null,
            claimedBy: null,
            nextAttemptAt: null,
            status: PurchaseLedgerStatus.Pending,
          })
          .where(
            and(
              eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter),
              inArray(purchaseLedger.id, [...ids]),
            ),
          )
          .returning({ id: purchaseLedger.id })
          .pipe(
            Effect.map((rows) => rows.length),
            Effect.mapError(portError("failed to requeue dead-lettered purchase ledger rows")),
          );
      },

      sweepTransientDeadLetters: ({ limit, minimumDeadLetterAgeSeconds }) =>
        db
          .transaction((tx) =>
            Effect.fn("sweepTransientDeadLetters")(function* () {
              const candidates = yield* tx
                .select({ id: purchaseLedger.id })
                .from(purchaseLedger)
                .where(
                  and(
                    eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter),
                    or(
                      isNull(purchaseLedger.lastError),
                      sql`${purchaseLedger.lastError} NOT LIKE 'decode failed:%'`,
                    ),
                    sql`COALESCE(${purchaseLedger.updatedAt}, ${purchaseLedger.createdAt}) <= NOW() - ${minimumDeadLetterAgeSeconds} * INTERVAL '1 second'`,
                  ),
                )
                .orderBy(asc(purchaseLedger.createdAt))
                .limit(limit)
                .for("update", { skipLocked: true });

              const requeued = Arr.isReadonlyArrayNonEmpty(candidates)
                ? yield* tx
                    .update(purchaseLedger)
                    .set({
                      attemptCount: 0,
                      claimedAt: null,
                      claimedBy: null,
                      nextAttemptAt: null,
                      status: PurchaseLedgerStatus.Pending,
                    })
                    .where(
                      and(
                        eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter),
                        inArray(
                          purchaseLedger.id,
                          candidates.map((candidate) => candidate.id),
                        ),
                      ),
                    )
                    .returning({ id: purchaseLedger.id })
                : [];
              const requeuedCount = Arr.length(requeued);

              const deadLetters = yield* tx
                .select({ count: sql<number>`count(*)` })
                .from(purchaseLedger)
                .where(eq(purchaseLedger.status, PurchaseLedgerStatus.DeadLetter));
              const pending = yield* tx
                .select({
                  count: sql<number>`count(*)`,
                  oldest: sql<Date | typeof Schema.Null.Type>`min(${purchaseLedger.createdAt})`,
                })
                .from(purchaseLedger)
                .where(eq(purchaseLedger.status, PurchaseLedgerStatus.Pending));
              const overdue = yield* tx
                .select({
                  count: sql<number>`count(*)`,
                  oldest: sql<
                    Date | typeof Schema.Null.Type
                  >`min(COALESCE(${purchaseLedger.nextAttemptAt}, ${purchaseLedger.createdAt}))`,
                })
                .from(purchaseLedger)
                .where(
                  and(
                    eq(purchaseLedger.status, PurchaseLedgerStatus.Pending),
                    or(
                      isNull(purchaseLedger.nextAttemptAt),
                      lte(purchaseLedger.nextAttemptAt, sql`NOW()`),
                    ),
                  ),
                );
              const pendingCount = Number(pending[0]?.count ?? 0);
              const oldest = pending[0]?.oldest;
              const overduePendingCount = Number(overdue[0]?.count ?? 0);
              const oldestOverdue = overdue[0]?.oldest;
              const now = yield* DateTime.nowAsDate;
              const oldestPendingAgeSeconds =
                pendingCount > 0 && oldest !== null && oldest !== undefined
                  ? Math.max(0, (now.getTime() - oldest.getTime()) / 1_000)
                  : 0;
              const oldestOverdueAgeSeconds =
                overduePendingCount > 0 && oldestOverdue !== null && oldestOverdue !== undefined
                  ? Math.max(0, (now.getTime() - oldestOverdue.getTime()) / 1_000)
                  : 0;

              return {
                deadLetterCount: Number(deadLetters[0]?.count ?? 0),
                oldestOverdueAgeSeconds,
                oldestPendingAgeSeconds,
                overduePendingCount,
                pendingCount,
                requeuedCount,
                transientCandidateCount: candidates.length,
              };
            })(),
          )
          .pipe(Effect.mapError(portError("failed to sweep purchase ledger dead letters"))),
    });
  }),
);
