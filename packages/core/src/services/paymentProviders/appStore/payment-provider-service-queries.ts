/**
 * DB-bound primitives for {@link AppStorePaymentProviderService}. App Store
 * owns provider/source-specific purchase identity resolution, so this module
 * contains both App Store configuration reads and App Store identity lookups.
 *
 * Per the queries-don't-cross-services rule, these lookups do not reach into
 * other services' query modules. `Db` is yielded fresh inside each method so
 * that queries route to the active transaction when one is in scope.
 */
import {
  type InsertPaymentProviderNotificationProcessed,
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PaymentProviderConfigurationProduct as DbPaymentProviderConfigurationProduct,
  type PaymentProviderNotificationProcessed as DbPaymentProviderNotificationProcessed,
  and,
  eq,
  lt,
  PersonOrigin,
  paymentProviderNotificationProcessed,
  personExternalIdentifiers,
  sql,
  type Project as DbProject,
  type DbError,
  Db,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Effect, Layer, Option, Context } from "effect";

/** Bound on `mergedIntoPersonId` chain-following — cycle/runaway backstop. */
const MAX_MERGE_CHAIN_HOPS = 10;

const make = Effect.gen(function* () {
  const db = yield* Db;

  const findPaymentProviderConfigurationsByProjectId = Effect.fn(
    "findPaymentProviderConfigurationsByProjectId",
  )(
    (
      projectId: string,
    ): Effect.Effect<ReadonlyArray<DbPaymentProviderConfiguration>, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderConfigurations.findMany({
          where: {
            projectId,
            deletedAt: { isNull: true },
          },
        });
      }),
  );

  const findPaymentProviderConfigurationProductByPrimaryKey = Effect.fn(
    "findPaymentProviderConfigurationProductByPrimaryKey",
  )(
    (input: {
      readonly paymentProviderConfigurationId: string;
      readonly providerProductKey: string;
    }): Effect.Effect<DbPaymentProviderConfigurationProduct | undefined, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderConfigurationProducts.findFirst({
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
            isActive: true,
          },
        });
      }),
  );

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
        return yield* db.query.projects.findFirst({
          where: { id },
        });
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
   * UNIQUE `(projectId, serviceId, identifier)` index. Used by the SDK path to
   * lazily bind a derived account token to the SDK-authenticated person; the
   * `ON CONFLICT ... DO UPDATE person_id` repoints an existing binding rather
   * than failing on the constraint.
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
   * Follows `persons.mergedIntoPersonId` to the surviving canonical person,
   * bounded to {@link MAX_MERGE_CHAIN_HOPS} so a (theoretical) cycle can't
   * spin. External-identifier rows are NOT repointed when their person is
   * merged away, so a webhook resolving an `apple-app-store` / account-token
   * binding must canonicalize the result before returning it, else post-merge
   * renewals would attribute to an archived person.
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
   * Rebinds an existing `person_external_identifier` row to a new `personId`.
   * Used by the SDK identity-rebind path when a later SDK confirmation reveals
   * that an `originalTransactionId` previously bound to an anonymous provider
   * person actually belongs to the SDK-authenticated person. The merge of the
   * anonymous person record itself is handled separately via
   * `PersonIdentityService.identifyDistinctId`.
   */
  const rebindExternalIdentifier = Effect.fn("rebindExternalIdentifier")(
    (input: {
      readonly id: string;
      readonly newPersonId: string;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.gen(function* () {
        yield* db
          .update(personExternalIdentifiers)
          .set({ personId: input.newPersonId })
          .where(eq(personExternalIdentifiers.id, input.id));
      }),
  );

  /**
   * Looks up the default (or first) distinctId bound to a person — used when
   * we need a `previousDistinctId` to merge an anonymous provider person into
   * the SDK-authenticated person via `identifyDistinctId`. Returns the
   * distinctId only; callers don't need the row metadata.
   */
  const findDistinctIdForPerson = Effect.fn("findDistinctIdForPerson")(
    (input: {
      readonly projectId: string;
      readonly personId: string;
    }): Effect.Effect<Option.Option<string>, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.personIdentities.findFirst({
          columns: { distinctId: true },
          where: {
            projectId: input.projectId,
            personId: input.personId,
          },
        });
        return Option.fromNullishOr(row?.distinctId);
      }),
  );

  /**
   * Inserts a row into `payment_provider_notification_processed`. Treats a
   * UNIQUE collision on `(configurationId, notificationUUID)` as success — the
   * second copy of the same notification has been processed already, so the
   * caller treats it as a duplicate delivery. Returns `{ inserted }` so the
   * webhook handler can distinguish first-arrival from duplicate at the wire
   * layer (above the per-event idempotency gate in `purchase_ledger`).
   *
   * `inserted` is decided by reading the surviving row back and comparing its
   * id to the one we tried to insert, which is driver-agnostic and race-safe.
   * The UNIQUE constraint serializes concurrent writers, so the row keeps the
   * *first* writer's id: a match means we won the insert; a mismatch means
   * another delivery got there first (a duplicate).
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

  /**
   * Lists parked notifications waiting for a `(configurationId, providerProductKey)`
   * mapping to appear. Used by the replay-on-product-creation flow.
   */
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

  /**
   * Lists notifications parked waiting for the SDK to confirm a given
   * `originalTransactionId`. Ordered by provider occurrence time with stable
   * receipt/id tie-breakers before the replay activity re-dispatches each row.
   */
  const findParkedNotificationsByOriginalTransactionId = Effect.fn(
    "findParkedNotificationsByOriginalTransactionId",
  )(
    (input: {
      readonly paymentProviderConfigurationId: string;
      readonly originalTransactionId: string;
    }): Effect.Effect<ReadonlyArray<DbPaymentProviderNotificationProcessed>, DbError, Db> =>
      Effect.gen(function* () {
        return yield* db.query.paymentProviderNotificationProcessed.findMany({
          orderBy: { providerOccurredAt: "asc", processedAt: "asc", id: "asc" },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            result: "parked_pending_sdk_confirmation",
            parkedUntilOriginalTransactionId: input.originalTransactionId,
          },
        });
      }),
  );

  /**
   * Lightweight first-seen guard for App Store reconciliation. Returns
   * `true` when a `subscription` row already exists for the given
   * `originalTransactionId` (stored as `subscription.storeSubscriptionId`),
   * which is sufficient evidence that we've already processed this
   * transaction at least once and don't need to walk Apple's full history.
   * Reconciliation itself is idempotent, so a missed-guard false negative is
   * only a wasted backfill — not a correctness issue.
   */
  const hasAnySubscriptionForStoreSubscriptionId = Effect.fn(
    "hasAnySubscriptionForStoreSubscriptionId",
  )(
    (input: { readonly storeSubscriptionId: string }): Effect.Effect<boolean, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.subscriptions.findFirst({
          columns: { id: true },
          where: { storeSubscriptionId: input.storeSubscriptionId },
        });
        return row !== undefined && row !== null;
      }),
  );

  /**
   * Returns `true` when any `subscription` or `transaction` row exists whose
   * Apple-side identifier matches `originalTransactionId`. Used as the
   * "SDK-confirmed" signal for the per-tenant
   * `trackNewPurchasesFromAppleServerNotifications = false` mode: under that
   * mode, webhooks never create purchases on their own, so the existence of
   * a `subscription` or `transaction` row for the series is equivalent to
   * "the SDK boundary has at least once recorded a purchase here". Covers
   * both subscriptions (matched via `subscription.storeSubscriptionId`) and
   * one-time / consumable charges (matched via `transaction.storeTransactionId`
   * — which equals `originalTransactionId` for the initial purchase of any
   * series).
   */
  const hasAnyAppStoreRecordForOriginalTransactionId = Effect.fn(
    "hasAnyAppStoreRecordForOriginalTransactionId",
  )(
    (input: { readonly originalTransactionId: string }): Effect.Effect<boolean, DbError, Db> =>
      Effect.gen(function* () {
        const subscription = yield* db.query.subscriptions.findFirst({
          columns: { id: true },
          where: { storeSubscriptionId: input.originalTransactionId },
        });
        if (subscription !== undefined && subscription !== null) {
          return true;
        }
        const transaction = yield* db.query.transactions.findFirst({
          columns: { id: true },
          where: { storeTransactionId: input.originalTransactionId },
        });
        return transaction !== undefined && transaction !== null;
      }),
  );

  /**
   * Marks a previously-parked notification row with a fresh outcome (e.g.
   * `"applied"` or `"failed"`) after the replay attempt resolves, clearing
   * the parked-state columns. Used by both park flavors
   * (`parked_pending_product_mapping` and `parked_pending_sdk_confirmation`).
   */
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
   * Bulk-expires SDK-confirmation parked rows whose `processedAt` is older
   * than the configured TTL. Drains stale park rows for tenants whose SDK
   * never confirms a series (RevenueCat-only users, uninstalled apps), so the
   * table doesn't grow unbounded. Idempotent — re-running over already-
   * expired rows is a no-op.
   *
   * Returns `{ expired }` so the scheduled workflow can log a summary.
   */
  const expireStaleParkedSdkConfirmationRows = Effect.fn("expireStaleParkedSdkConfirmationRows")(
    (input: {
      readonly olderThan: Date;
    }): Effect.Effect<{ readonly expired: number }, DbError, Db> =>
      Effect.gen(function* () {
        const result = yield* db
          .update(paymentProviderNotificationProcessed)
          .set({
            parkedRawPayload: null,
            parkedUntilOriginalTransactionId: null,
            processedAt: sql`NOW()`,
            result: "expired",
            resultNote: "auto-expired pending SDK confirmation",
          })
          .where(
            and(
              eq(paymentProviderNotificationProcessed.result, "parked_pending_sdk_confirmation"),
              lt(paymentProviderNotificationProcessed.processedAt, input.olderThan),
            ),
          )
          .returning({ id: paymentProviderNotificationProcessed.id });
        return { expired: result.length };
      }),
  );

  /**
   * Reports whether `personId` is a webhook-created App Store stand-in — the
   * synthetic anonymous person the webhook (or reconciliation) parks a
   * transaction on before SDK confirmation, marked at creation with
   * `PersonOrigin.AppStoreWebhook`.
   *
   * The SDK identity-rebind path merges only these stand-ins — they exist
   * solely to hold the transaction until the real user confirms. A genuine
   * person — an anonymous SDK user or an identified user — that owns the
   * transaction is left intact; its subscription is transferred instead of
   * its whole identity merged away. A missing person resolves to `false` (the
   * non-destructive transfer path).
   */
  const isAppStoreWebhookStandInPerson = Effect.fn("isAppStoreWebhookStandInPerson")(
    (input: {
      readonly projectId: string;
      readonly personId: string;
    }): Effect.Effect<boolean, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.persons.findFirst({
          columns: { origin: true },
          where: {
            id: input.personId,
            projectId: input.projectId,
          },
        });
        return row?.origin === PersonOrigin.AppStoreWebhook;
      }),
  );

  /**
   * Finds the subscription tied to an App Store `originalTransactionId`
   * (stored as `subscription.storeSubscriptionId`). Apple guarantees
   * `originalTransactionId` is globally unique, so the unscoped lookup is
   * safe — same pattern as {@link hasAnySubscriptionForStoreSubscriptionId}.
   */
  const findSubscriptionByStoreSubscriptionId = Effect.fn("findSubscriptionByStoreSubscriptionId")(
    (input: {
      readonly storeSubscriptionId: string;
    }): Effect.Effect<Option.Option<{ readonly id: string }>, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.subscriptions.findFirst({
          columns: { id: true },
          where: { storeSubscriptionId: input.storeSubscriptionId },
        });
        return Option.fromNullishOr(row);
      }),
  );

  /**
   * Finds the one-time purchase keyed by `purchase.providerKey` (the App Store
   * `transactionId` for one-time charges). `provider_key` carries a global
   * UNIQUE index. Returns `type` so the caller can skip consumables.
   */
  const findPurchaseByProviderKey = Effect.fn("findPurchaseByProviderKey")(
    (input: {
      readonly providerKey: string;
    }): Effect.Effect<Option.Option<{ readonly id: string; readonly type: number }>, DbError, Db> =>
      Effect.gen(function* () {
        const row = yield* db.query.purchases.findFirst({
          columns: { id: true, type: true },
          where: { providerKey: input.providerKey },
        });
        return Option.fromNullishOr(row);
      }),
  );

  return constant({
    createExternalIdentifier,
    expireStaleParkedSdkConfirmationRows,
    findDistinctIdForPerson,
    findExternalIdentifier,
    findParkedNotifications,
    findParkedNotificationsByOriginalTransactionId,
    findPaymentProviderConfigurationById,
    findPaymentProviderConfigurationsByProjectId,
    findPaymentProviderConfigurationProductByPrimaryKey,
    findPersonIdentityByDistinctId,
    findProjectById,
    findPurchaseByProviderKey,
    findSubscriptionByStoreSubscriptionId,
    hasAnyAppStoreRecordForOriginalTransactionId,
    hasAnySubscriptionForStoreSubscriptionId,
    insertNotificationProcessedIfAbsent,
    isAppStoreWebhookStandInPerson,
    resolveCanonicalPersonId,
    upsertExternalIdentifier,
    markParkedNotificationResolved,
    markParkedNotificationAttempted,
    rebindExternalIdentifier,
  });
});

export type AppStorePaymentProviderServiceQueriesShape = Effect.Success<typeof make>;

export class AppStorePaymentProviderServiceQueries extends Context.Service<AppStorePaymentProviderServiceQueries>()(
  "core/AppStorePaymentProviderServiceQueries",
  { make },
) {
  static readonly layer: Layer.Layer<AppStorePaymentProviderServiceQueries, never, Db> =
    Layer.effect(AppStorePaymentProviderServiceQueries)(AppStorePaymentProviderServiceQueries.make);
}
