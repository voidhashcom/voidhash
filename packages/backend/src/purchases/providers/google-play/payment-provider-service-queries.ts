import * as Schema from "effect/Schema";
/**
 * DB-bound primitives for the Google Play payment-provider services. Mirrors
 * the App Store query module — Google Play owns its own provider/source-specific
 * purchase identity resolution, so this module contains both Google Play
 * configuration reads and Google Play identity lookups, keyed on the
 * `"google-play"` serviceId and the Google subscription series id
 * (`purchaseToken`, stored as `subscription.storeSubscriptionId`).
 *
 * `Db` is yielded fresh inside each method so that queries route to the active
 * transaction when one is in scope.
 */
import {
  type InsertPaymentProviderNotificationProcessed,
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PaymentProviderConfigurationProduct as DbPaymentProviderConfigurationProduct,
  type PaymentProviderNotificationProcessed as DbPaymentProviderNotificationProcessed,
  eq,
  PersonOrigin,
  paymentProviderNotificationProcessed,
  personExternalIdentifiers,
  sql,
  type Project as DbProject,
  type DbError,
  Db,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Context from "effect/Context";

import { googlePlayMappingMatchesProviderProductKey } from "./helpers.ts";

/** Bound on `mergedIntoPersonId` chain-following — cycle/runaway backstop. */
const MAX_MERGE_CHAIN_HOPS = 10;

const make = Effect.fn("make")(function* () {
  const db = yield* Db;

  const findPaymentProviderConfigurationsByProjectId = Effect.fn(
    "findPaymentProviderConfigurationsByProjectId",
  )(
    (
      projectId: string,
    ): Effect.Effect<ReadonlyArray<DbPaymentProviderConfiguration>, DbError, Db> =>
      Effect.fn("findPaymentProviderConfigurationsByProjectId")(function* () {
        return yield* db.query.paymentProviderConfigurations.findMany({
          where: {
            projectId,
            deletedAt: { isNull: true },
          },
        });
      })(),
  );

  const findPaymentProviderConfigurationProductByPrimaryKey = Effect.fn(
    "findPaymentProviderConfigurationProductByPrimaryKey",
  )(
    (input: {
      readonly paymentProviderConfigurationId: string;
      readonly providerProductKey: string;
    }): Effect.Effect<
      DbPaymentProviderConfigurationProduct | typeof Schema.Undefined.Type,
      DbError,
      Db
    > =>
      Effect.fn("findPaymentProviderConfigurationProductByPrimaryKey")(function* () {
        return yield* db.query.paymentProviderConfigurationProducts.findFirst({
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
            isActive: true,
          },
        });
      })(),
  );

  const findPaymentProviderConfigurationById = Effect.fn("findPaymentProviderConfigurationById")(
    (
      id: string,
    ): Effect.Effect<DbPaymentProviderConfiguration | typeof Schema.Undefined.Type, DbError, Db> =>
      Effect.fn("findPaymentProviderConfigurationById")(function* () {
        return yield* db.query.paymentProviderConfigurations.findFirst({
          where: {
            id,
            deletedAt: { isNull: true },
          },
        });
      })(),
  );

  const findProjectById = Effect.fn("findProjectById")(
    (id: string): Effect.Effect<DbProject | typeof Schema.Undefined.Type, DbError, Db> =>
      Effect.fn("findProjectById")(function* () {
        return yield* db.query.projects.findFirst({ where: { id } });
      })(),
  );

  const findPersonIdentityByDistinctId = Effect.fn("findPersonIdentityByDistinctId")(
    (input: {
      readonly projectId: string;
      readonly distinctId: string;
    }): Effect.Effect<Option.Option<{ readonly personId: string }>, DbError, Db> =>
      Effect.fn("findPersonIdentityByDistinctId")(function* () {
        const row = yield* db.query.personIdentities.findFirst({
          columns: { personId: true },
          where: {
            projectId: input.projectId,
            distinctId: input.distinctId,
          },
        });
        return Option.fromNullishOr(row);
      })(),
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
      Effect.fn("findExternalIdentifier")(function* () {
        const row = yield* db.query.personExternalIdentifiers.findFirst({
          columns: { id: true, personId: true },
          where: {
            projectId: input.projectId,
            serviceId: input.serviceId,
            identifier: input.identifier,
          },
        });
        return Option.fromNullishOr(row);
      })(),
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
      Effect.fn("createExternalIdentifier")(function* () {
        yield* db.insert(personExternalIdentifiers).values(input);
        return { id: input.id };
      })(),
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
      Effect.fn("upsertExternalIdentifier")(function* () {
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
      })(),
  );

  /**
   * Follows `persons.mergedIntoPersonId` to the surviving canonical person,
   * bounded to {@link MAX_MERGE_CHAIN_HOPS}. External-identifier rows are NOT
   * repointed when their person is merged away (the identify-completion
   * workflow only touches `person_identity`), so a webhook resolving a
   * `google-play` / account-token binding must canonicalize the result before
   * returning it, else post-merge renewals would attribute to an archived
   * person.
   */
  const resolveCanonicalPersonId = Effect.fn("resolveCanonicalPersonId")(
    (input: { readonly personId: string }): Effect.Effect<string, DbError, Db> =>
      Effect.fn("resolveCanonicalPersonIdLoop")(function loop(
        currentId: string,
        hop: number,
      ): Effect.Effect<string, DbError> {
        if (hop >= MAX_MERGE_CHAIN_HOPS) return Effect.succeed(currentId);
        return db.query.persons
          .findFirst({
            columns: { mergedIntoPersonId: true },
            where: { id: currentId },
          })
          .pipe(
            Effect.flatMap((row) => {
              const mergedInto = row?.mergedIntoPersonId;
              return !mergedInto || mergedInto === currentId
                ? Effect.succeed(currentId)
                : loop(mergedInto, hop + 1);
            }),
          );
      })(input.personId, 0),
  );

  /**
   * Rebinds an existing `person_external_identifier` row to a new `personId`.
   * Used by the SDK identity-rebind path when a later SDK confirmation reveals
   * that a `purchaseToken` previously bound to an anonymous provider person
   * actually belongs to the SDK-authenticated person.
   */
  const rebindExternalIdentifier = Effect.fn("rebindExternalIdentifier")(
    (input: {
      readonly id: string;
      readonly newPersonId: string;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.fn("rebindExternalIdentifier")(function* () {
        yield* db
          .update(personExternalIdentifiers)
          .set({ personId: input.newPersonId })
          .where(eq(personExternalIdentifiers.id, input.id));
      })(),
  );

  /**
   * Looks up the default (or first) distinctId bound to a person — used when we
   * need a `previousDistinctId` to merge an anonymous provider person into the
   * SDK-authenticated person via `identifyDistinctId`.
   */
  const findDistinctIdForPerson = Effect.fn("findDistinctIdForPerson")(
    (input: {
      readonly projectId: string;
      readonly personId: string;
    }): Effect.Effect<Option.Option<string>, DbError, Db> =>
      Effect.fn("findDistinctIdForPerson")(function* () {
        const row = yield* db.query.personIdentities.findFirst({
          columns: { distinctId: true },
          where: {
            projectId: input.projectId,
            personId: input.personId,
          },
        });
        return Option.fromNullishOr(row?.distinctId);
      })(),
  );

  /**
   * Inserts a row into `payment_provider_notification_processed`. Treats a
   * UNIQUE collision on `(configurationId, notificationUUID)` as success — the
   * second copy of the same notification has been processed already. Returns
   * `{ inserted }` so the webhook handler can distinguish first-arrival from
   * duplicate at the wire layer.
   *
   * `inserted` is decided by reading the surviving row back and comparing its
   * id to the one we tried to insert, which is driver-agnostic and race-safe.
   * The UNIQUE constraint serializes concurrent writers, so the row keeps the
   * *first* writer's id.
   */
  const insertNotificationProcessedIfAbsent = Effect.fn("insertNotificationProcessedIfAbsent")(
    (
      input: InsertPaymentProviderNotificationProcessed,
    ): Effect.Effect<{ readonly inserted: boolean }, DbError, Db> =>
      Effect.fn("insertNotificationProcessedIfAbsent")(function* () {
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
      })(),
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
      Effect.fn("findParkedNotifications")(function* () {
        const parked = yield* db.query.paymentProviderNotificationProcessed.findMany({
          orderBy: { providerOccurredAt: "asc", processedAt: "asc", id: "asc" },
          where: {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            result: "parked_pending_product_mapping",
          },
        });
        return parked.filter((row) => {
          const parkedKey = row.parkedUntilProviderProductKey;
          return (
            parkedKey !== null &&
            googlePlayMappingMatchesProviderProductKey(input.providerProductKey, parkedKey)
          );
        });
      })(),
  );

  /** Records a retryable replay attempt while keeping the notification parked. */
  const markParkedNotificationAttempted = Effect.fn("markParkedNotificationAttempted")(
    (input: {
      readonly id: string;
      readonly resultNote: string;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.fn("markParkedNotificationAttempted")(function* () {
        yield* db
          .update(paymentProviderNotificationProcessed)
          .set({
            attemptCount: sql`${paymentProviderNotificationProcessed.attemptCount} + 1`,
            lastAttemptedAt: sql`NOW()`,
            resultNote: input.resultNote.slice(0, 500),
          })
          .where(eq(paymentProviderNotificationProcessed.id, input.id));
      })(),
  );

  /**
   * Marks a previously-parked notification row with a fresh outcome (`"applied"`
   * / `"failed"`) after the replay attempt resolves, clearing the parked-state
   * columns.
   */
  const markParkedNotificationResolved = Effect.fn("markParkedNotificationResolved")(
    (input: {
      readonly id: string;
      readonly result: string;
      readonly resultNote: string | typeof Schema.Null.Type;
    }): Effect.Effect<void, DbError, Db> =>
      Effect.fn("markParkedNotificationResolved")(function* () {
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
      })(),
  );

  /**
   * Reports whether `personId` is a webhook-created Google Play stand-in — the
   * synthetic anonymous person an RTDN (or reconciliation) parks a purchase on
   * before SDK confirmation, marked at creation with
   * `PersonOrigin.GooglePlayWebhook`. A missing person resolves to `false`.
   */
  const isGooglePlayWebhookStandInPerson = Effect.fn("isGooglePlayWebhookStandInPerson")(
    (input: {
      readonly projectId: string;
      readonly personId: string;
    }): Effect.Effect<boolean, DbError, Db> =>
      Effect.fn("isGooglePlayWebhookStandInPerson")(function* () {
        const row = yield* db.query.persons.findFirst({
          columns: { origin: true },
          where: {
            id: input.personId,
            projectId: input.projectId,
          },
        });
        return row?.origin === PersonOrigin.GooglePlayWebhook;
      })(),
  );

  /**
   * Finds the subscription tied to a Google Play `purchaseToken` (stored as
   * `subscription.storeSubscriptionId`). Google purchase tokens are globally
   * unique, so the unscoped lookup is safe. Returns the series' product
   * binding as well, so callers acting on a *different* purchase's series (the
   * `linkedPurchaseToken` supersede path) can address it and verify it belongs
   * to the same provider configuration.
   */
  const findSubscriptionByStoreSubscriptionId = Effect.fn("findSubscriptionByStoreSubscriptionId")(
    (input: {
      readonly storeSubscriptionId: string;
    }): Effect.Effect<
      Option.Option<{
        readonly id: string;
        readonly paymentProviderConfigurationProductId: string;
        readonly paymentProviderConfigurationId: string | typeof Schema.Undefined.Type;
      }>,
      DbError,
      Db
    > =>
      Effect.fn("findSubscriptionByStoreSubscriptionId")(function* () {
        const row = yield* db.query.subscriptions.findFirst({
          columns: { id: true, paymentProviderConfigurationProductId: true },
          where: { storeSubscriptionId: input.storeSubscriptionId },
          with: {
            paymentProviderConfigurationProduct: {
              columns: { paymentProviderConfigurationId: true },
            },
          },
        });
        if (!row) return Option.none();
        return Option.some({
          id: row.id,
          paymentProviderConfigurationId:
            row.paymentProviderConfigurationProduct?.paymentProviderConfigurationId,
          paymentProviderConfigurationProductId: row.paymentProviderConfigurationProductId,
        });
      })(),
  );

  /**
   * Finds the one-time purchase keyed by `purchase.providerKey` (the Google
   * `orderId` for one-time charges). Returns `type` so the caller can skip
   * consumables.
   */
  const findPurchaseByProviderKey = Effect.fn("findPurchaseByProviderKey")(
    (input: {
      readonly providerKey: string;
    }): Effect.Effect<Option.Option<{ readonly id: string; readonly type: number }>, DbError, Db> =>
      Effect.fn("findPurchaseByProviderKey")(function* () {
        const row = yield* db.query.purchases.findFirst({
          columns: { id: true, type: true },
          where: { providerKey: input.providerKey },
        });
        return Option.fromNullishOr(row);
      })(),
  );

  return constant({
    createExternalIdentifier,
    findDistinctIdForPerson,
    findExternalIdentifier,
    findParkedNotifications,
    findPaymentProviderConfigurationById,
    findPaymentProviderConfigurationsByProjectId,
    findPaymentProviderConfigurationProductByPrimaryKey,
    findPersonIdentityByDistinctId,
    findProjectById,
    findPurchaseByProviderKey,
    findSubscriptionByStoreSubscriptionId,
    insertNotificationProcessedIfAbsent,
    isGooglePlayWebhookStandInPerson,
    markParkedNotificationResolved,
    markParkedNotificationAttempted,
    rebindExternalIdentifier,
    resolveCanonicalPersonId,
    upsertExternalIdentifier,
  });
})();

export type GooglePlayPaymentProviderServiceQueriesShape = Effect.Success<typeof make>;

export class GooglePlayPaymentProviderServiceQueries extends Context.Service<GooglePlayPaymentProviderServiceQueries>()(
  "@voidhash/backend/purchases/GooglePlayPaymentProviderServiceQueries",
  { make },
) {
  static readonly layer: Layer.Layer<GooglePlayPaymentProviderServiceQueries, never, Db> =
    Layer.effect(GooglePlayPaymentProviderServiceQueries)(
      GooglePlayPaymentProviderServiceQueries.make,
    );
}
