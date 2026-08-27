/**
 * DB-bound primitives for the Stripe payment-provider engine and webhook
 * handler. Mirrors `appStore/payment-provider-service-queries.ts`: configuration
 * reads, Stripe-customer identity lookups, and the provider-agnostic
 * wire-dedup / parking ledger. `Db` is yielded once and captured by closure.
 */
import {
  type InsertPaymentProviderNotificationProcessed,
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PaymentProviderNotificationProcessed as DbPaymentProviderNotificationProcessed,
  eq,
  paymentProviderNotificationProcessed,
  personExternalIdentifiers,
  sql,
  type Project as DbProject,
  type DbError,
  Db,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Option } from "effect";

/** Bound on `mergedIntoPersonId` chain-following — cycle/runaway backstop. */
const MAX_MERGE_CHAIN_HOPS = 10;

const make = Effect.gen(function* () {
  const db = yield* Db;

  const findPaymentProviderConfigurationById = Effect.fn("findPaymentProviderConfigurationById")(
    (id: string): Effect.Effect<DbPaymentProviderConfiguration | undefined, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderConfigurations.findFirst({
          where: {
            id,
            deletedAt: { isNull: true },
          },
        });
      }),
  );

  const findProjectById = Effect.fn("findProjectById")(
    (id: string): Effect.Effect<DbProject | undefined, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.projects.findFirst({ where: { id } });
      }),
  );

  /**
   * Resolves the active product mapping for a `(configuration, providerProductKey)`
   * pair, joining the internal product so the engine can distinguish a one-time
   * vs consumable purchase from `product.type` (Stripe has no consumable
   * concept). Returns the mapping id + the internal product type.
   */
  const findActiveProviderProductByPrimaryKey = Effect.fn("findActiveProviderProductByPrimaryKey")(
    (input: {
      readonly paymentProviderConfigurationId: string;
      readonly providerProductKey: string;
    }): Effect.Effect<
      Option.Option<{ readonly id: string; readonly productType: number | undefined }>,
      DbError,
      Db
    > =>
      Effect.gen(function* () {
        const row = yield* db.query.paymentProviderConfigurationProducts.findFirst({
          columns: { id: true },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
            isActive: true,
          },
          with: { product: { columns: { type: true } } },
        });
        if (row) return Option.some({ id: row.id, productType: row.product?.type });
        return Option.none<{ readonly id: string; readonly productType: number | undefined }>();
      }),
  );

  const findPersonIdentityByDistinctId = Effect.fn("findPersonIdentityByDistinctId")(
    (input: {
      readonly projectId: string;
      readonly distinctId: string;
    }): Effect.Effect<Option.Option<{ readonly personId: string }>, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.personIdentities.findFirst({
          columns: { personId: true },
          where: {
            projectId: input.projectId,
            distinctId: input.distinctId,
          },
        });
        return Option.fromNullishOr(row);
      }),
  );

  const findExternalIdentifier = Effect.fn("findExternalIdentifier")(
    (input: {
      readonly projectId: string;
      readonly serviceId: string;
      readonly identifier: string;
    }): Effect.Effect<
      Option.Option<{ readonly id: string; readonly personId: string }>,
      DbError,
      Db
    > =>
      Effect.gen(function* () {
        const row = yield* db.query.personExternalIdentifiers.findFirst({
          columns: { id: true, personId: true },
          where: {
            projectId: input.projectId,
            serviceId: input.serviceId,
            identifier: input.identifier,
          },
        });
        return Option.fromNullishOr(row);
      }),
  );

  const createExternalIdentifier = Effect.fn("createExternalIdentifier")(
    (input: {
      readonly id: string;
      readonly projectId: string;
      readonly personId: string;
      readonly serviceId: string;
      readonly identifier: string;
      readonly isDefault: boolean;
    }): Effect.Effect<{ readonly id: string }, DbError, Db> =>
      Effect.gen(function* () {
        yield* db.insert(personExternalIdentifiers).values(input);
        return { id: input.id };
      }),
  );

  /**
   * Insert-or-repoint of a `person_external_identifier` row, keyed by the
   * UNIQUE `(projectId, serviceId, identifier)` index. Used to bind a Stripe
   * customer id to the resolved person without failing on the constraint.
   */
  const upsertExternalIdentifier = Effect.fn("upsertExternalIdentifier")(
    (input: {
      readonly id: string;
      readonly projectId: string;
      readonly personId: string;
      readonly serviceId: string;
      readonly identifier: string;
      readonly isDefault: boolean;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.gen(function* () {
        yield* db
          .insert(personExternalIdentifiers)
          .values(input)
          .onConflictDoUpdate({
            target: [
              personExternalIdentifiers.projectId,
              personExternalIdentifiers.serviceId,
              personExternalIdentifiers.identifier,
            ],
            set: { personId: input.personId },
          });
      }),
  );

  /**
   * Follows `persons.mergedIntoPersonId` to the surviving canonical person.
   * External-identifier rows are not repointed on identity merge, so a Stripe
   * customer binding must canonicalize before returning.
   */
  const resolveCanonicalPersonId = Effect.fn("resolveCanonicalPersonId")(
    (input: { readonly personId: string }): Effect.Effect<string, DbError, Db> =>
      Effect.gen(function* () {
        let currentId = input.personId;
        for (let hop = 0; hop < MAX_MERGE_CHAIN_HOPS; hop++) {
          const row = yield* db.query.persons.findFirst({
            columns: { mergedIntoPersonId: true },
            where: { id: currentId },
          });
          const mergedInto = row?.mergedIntoPersonId;
          if (!mergedInto || mergedInto === currentId) {
            return currentId;
          }
          currentId = mergedInto;
        }
        return currentId;
      }),
  );

  /**
   * Wire-level dedup insert keyed UNIQUE on `(configurationId, notificationUuid)`
   * — Stripe `event.id`. `inserted` is decided by reading the surviving row
   * back and comparing ids, NOT a driver-reported affected count: the UNIQUE
   * constraint serializes concurrent writers, so the row keeps the *first*
   * writer's id.
   */
  const insertNotificationProcessedIfAbsent = Effect.fn("insertNotificationProcessedIfAbsent")(
    (
      input: InsertPaymentProviderNotificationProcessed,
    ): Effect.Effect<{ readonly inserted: boolean }, DbError, Db> =>
      Effect.gen(function* () {
        yield* db
          .insert(paymentProviderNotificationProcessed)
          .values(input)
          .onConflictDoNothing({
            target: [
              paymentProviderNotificationProcessed.paymentProviderConfigurationId,
              paymentProviderNotificationProcessed.notificationUuid,
            ],
          });
        const surviving = yield* db.query.paymentProviderNotificationProcessed.findFirst({
          columns: { id: true },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            notificationUuid: input.notificationUuid,
          },
        });
        return { inserted: surviving?.id === input.id };
      }),
  );

  /** Lists notifications parked waiting for a `(configurationId, providerProductKey)` mapping. */
  const findParkedNotifications = Effect.fn("findParkedNotifications")(
    (input: {
      readonly paymentProviderConfigurationId: string;
      readonly providerProductKey: string;
    }): Effect.Effect<ReadonlyArray<DbPaymentProviderNotificationProcessed>, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderNotificationProcessed.findMany({
          orderBy: { providerOccurredAt: "asc", processedAt: "asc", id: "asc" },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            result: "parked_pending_product_mapping",
            parkedUntilProviderProductKey: input.providerProductKey,
          },
        });
      }),
  );

  /** Lists dependent Stripe events waiting for their original transaction. */
  const findParkedTransactionNotifications = Effect.fn("findParkedTransactionNotifications")(
    (input: {
      readonly paymentProviderConfigurationId: string;
    }): Effect.Effect<ReadonlyArray<DbPaymentProviderNotificationProcessed>, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderNotificationProcessed.findMany({
          orderBy: { providerOccurredAt: "asc", processedAt: "asc", id: "asc" },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            result: "parked_pending_transaction",
          },
        });
      }),
  );

  /** Records a retryable replay attempt while keeping the notification parked. */
  const markParkedNotificationAttempted = Effect.fn("markParkedNotificationAttempted")(
    (input: {
      readonly id: string;
      readonly resultNote: string;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.gen(function* () {
        yield* db
          .update(paymentProviderNotificationProcessed)
          .set({
            attemptCount: sql`${paymentProviderNotificationProcessed.attemptCount} + 1`,
            lastAttemptedAt: sql`NOW()`,
            resultNote: input.resultNote.slice(0, 500),
          })
          .where(eq(paymentProviderNotificationProcessed.id, input.id));
      }),
  );

  /** Marks a parked notification row resolved, clearing its parked-state columns. */
  const markParkedNotificationResolved = Effect.fn("markParkedNotificationResolved")(
    (input: {
      readonly id: string;
      readonly result: string;
      readonly resultNote: string | null;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.gen(function* () {
        yield* db
          .update(paymentProviderNotificationProcessed)
          .set({
            attemptCount: sql`${paymentProviderNotificationProcessed.attemptCount} + 1`,
            lastAttemptedAt: sql`NOW()`,
            parkedRawPayload: null,
            parkedUntilOriginalTransactionId: null,
            parkedUntilProviderProductKey: null,
            processedAt: sql`NOW()`,
            result: input.result,
            resultNote: input.resultNote,
          })
          .where(eq(paymentProviderNotificationProcessed.id, input.id));
      }),
  );

  /**
   * Resolves the product mapping + owning person for a refund/reversal/dispute
   * event by the existing transaction the original purchase wrote. Refund
   * webhooks carry only a charge (no price/product), so the mapping is
   * recovered from that transaction.
   *
   * The lookup matches on ANY of the candidate store-transaction ids the
   * refund-side object exposes (`payment_intent`, `charge` id, `invoice` id),
   * because Stripe surfaces the paid-charge identifier in different fields
   * across API versions — the original purchase may have keyed the transaction
   * on the payment intent, the charge, or (fallback) the invoice id, and the
   * later refund object may expose a different one of those. Returns the matched
   * `storeTransactionId` so the caller marks the right transaction refunded.
   */
  const findTransactionByAnyStoreTransactionId = Effect.fn(
    "findTransactionByAnyStoreTransactionId",
  )((input: {
    readonly storeTransactionIds: ReadonlyArray<string>;
  }): Effect.Effect<
    Option.Option<{
      readonly id: string;
      readonly paymentProviderConfigurationProductId: string;
      readonly personId: string;
      readonly storeTransactionId: string | null;
    }>,
    DbError,
    Db
  > => {
    const keys = [...new Set(input.storeTransactionIds.filter((key) => key.length > 0))];
    if (keys.length === 0) {
      return Effect.succeedNone;
    }
    return Effect.gen(function* () {
      const row = yield* db.query.transactions.findFirst({
        columns: {
          id: true,
          paymentProviderConfigurationProductId: true,
          personId: true,
          storeTransactionId: true,
        },
        where: { storeTransactionId: { in: keys } },
      });
      return Option.fromNullishOr(row);
    });
  });

  return constant({
    createExternalIdentifier,
    findActiveProviderProductByPrimaryKey,
    findExternalIdentifier,
    findParkedNotifications,
    findParkedTransactionNotifications,
    findPaymentProviderConfigurationById,
    findPersonIdentityByDistinctId,
    findProjectById,
    findTransactionByAnyStoreTransactionId,
    insertNotificationProcessedIfAbsent,
    markParkedNotificationResolved,
    markParkedNotificationAttempted,
    resolveCanonicalPersonId,
    upsertExternalIdentifier,
  });
});

export type StripePaymentProviderServiceQueriesShape = Effect.Success<typeof make>;

export class StripePaymentProviderServiceQueries extends Context.Service<StripePaymentProviderServiceQueries>()(
  "core/StripePaymentProviderServiceQueries",
  { make },
) {
  static readonly layer: Layer.Layer<StripePaymentProviderServiceQueries, never, Db> = Layer.effect(
    StripePaymentProviderServiceQueries,
  )(StripePaymentProviderServiceQueries.make);
}
