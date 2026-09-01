import {
  EntitlementSync,
  PurchaseEventPublisher,
  PurchaseIdGenerator,
  PurchaseLedgerWriteStore,
  PurchasePortError,
  PurchaseProcessingResult,
  PurchaseStateRepository,
  PurchaseUnitOfWork,
  decodePurchaseProcessingResult,
  encodePurchaseProcessingResult,
  type PurchaseLedgerReservationResult,
  type PurchaseLedgerWriteStoreShape,
} from "@voidhash/core-v2";
import { PerkGrantService } from "@voidhash/core/services/perkGrants/PerkGrantService";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Db, type DbTransaction, eq, purchaseLedger } from "@voidhash/db";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { makeDbPurchaseStateRepository } from "./DbPurchaseStateRepositoryLive.ts";

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

const emptyReservedResult = (personId: string) =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: true,
    personId,
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

/** Builds the purchase-ledger write port bound to one database transaction. */
export const makeDbPurchaseLedgerWriteStore = (
  tx: DbTransaction,
): PurchaseLedgerWriteStoreShape => ({
  finalize: ({ reservation, result }) =>
    tx
      .update(purchaseLedger)
      .set({ eventsPayload: [], resultPayload: encodePurchaseProcessingResult(result) })
      .where(eq(purchaseLedger.id, reservation.id))
      .returning({ id: purchaseLedger.id })
      .pipe(Effect.asVoid, Effect.mapError(portError("failed to finalize purchase ledger row"))),
  reserve: (input) =>
    Effect.gen(function* () {
      yield* tx
        .insert(purchaseLedger)
        .values({
          ...input,
          eventsPayload: [],
          resultPayload: encodePurchaseProcessingResult(emptyReservedResult(input.personId)),
        })
        .onConflictDoNothing({ target: purchaseLedger.idempotencyKey });
      const surviving = yield* tx.query.purchaseLedger.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (surviving === undefined) {
        return yield* Effect.fail(
          `purchase ledger reservation lost but no row was readable (idempotencyKey=${input.idempotencyKey})`,
        );
      }
      if (surviving.id === input.id) {
        return {
          _tag: "reserved",
          reservation: { id: input.id },
        } satisfies PurchaseLedgerReservationResult;
      }
      return {
        _tag: "duplicate",
        result: decodePurchaseProcessingResult(surviving.resultPayload),
      } satisfies PurchaseLedgerReservationResult;
    }).pipe(Effect.mapError(portError("failed to reserve purchase ledger row"))),
  stageEvents: ({ events, reservation, result }) =>
    tx
      .update(purchaseLedger)
      .set({
        eventsPayload: events,
        resultPayload: encodePurchaseProcessingResult(result),
      })
      .where(eq(purchaseLedger.id, reservation.id))
      .returning({ id: purchaseLedger.id })
      .pipe(Effect.asVoid, Effect.mapError(portError("failed to stage purchase ledger events"))),
});

/** Core identifier generation backed by the repository's canonical id utility. */
export const PurchaseIdGeneratorLive = Layer.succeed(PurchaseIdGenerator, {
  generate: generateId,
});

/** Post-commit lifecycle publication backed by the webhook publisher. */
export const PurchaseEventPublisherLive = Layer.effect(
  PurchaseEventPublisher,
  Effect.gen(function* () {
    const publisher = yield* WebhookEventPublisher;
    return PurchaseEventPublisher.of({
      publish: (event) =>
        publisher
          .publish(event)
          .pipe(Effect.mapError(portError("failed to publish purchase event"))),
    });
  }),
);

/** PostgreSQL transaction boundary for core purchase processing. */
export const DbPurchaseUnitOfWorkLive = Layer.effect(
  PurchaseUnitOfWork,
  Effect.gen(function* () {
    const db = yield* Db;
    const perkGrants = yield* PerkGrantService;
    return PurchaseUnitOfWork.of({
      transact: (effect) =>
        db
          .transaction((tx) =>
            effect.pipe(
              Effect.provideService(PurchaseStateRepository, makeDbPurchaseStateRepository(tx)),
              Effect.provideService(PurchaseLedgerWriteStore, makeDbPurchaseLedgerWriteStore(tx)),
              Effect.provideService(EntitlementSync, {
                syncUnlockedPerks: (personId) =>
                  perkGrants
                    .syncUnlockedPerks(tx, personId)
                    .pipe(
                      Effect.mapError(portError("failed to synchronize purchase entitlements")),
                    ),
              }),
            ),
          )
          .pipe(
            Effect.catchTag("SqlError", (error) =>
              Effect.fail(
                new PurchasePortError({ cause: error, message: "purchase transaction failed" }),
              ),
            ),
          ),
    });
  }),
);
