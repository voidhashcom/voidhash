import {
  PurchasePortError,
  PurchaseProductContext,
  PurchaseRecord,
  PurchaseStateRepository,
  PurchaseSubscriptionRecord,
  PurchaseTransactionRecord,
  type PurchaseStateRepositoryShape,
} from "@voidhash/core-v2";
import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";
import {
  Db,
  type DbTransaction,
  and,
  eq,
  isNull,
  lte,
  or,
  purchases,
  sql,
  subscriptions,
  transactions,
} from "@voidhash/db";
import { Effect, Layer, Schema } from "effect";

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

const decodeOptional = <S extends Schema.Top>(schema: S, value: unknown, message: string) => {
  if (value === undefined || value === null) return Effect.succeed(undefined);
  return Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError(portError(message)));
};

const decodeRequired = <S extends Schema.Top>(schema: S, value: unknown, message: string) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError(portError(message)));

/** Builds a purchase-state repository bound to one database transaction or connection. */
export const makeDbPurchaseStateRepository = (
  db: typeof Db.Service | DbTransaction,
): PurchaseStateRepositoryShape => ({
  countActivePurchases: (personId) =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(purchases)
      .where(
        and(
          eq(purchases.personId, personId),
          eq(purchases.type, PurchaseType.OneTime),
          isNull(purchases.refundedAt),
          isNull(purchases.revokedAt),
        ),
      )
      .pipe(
        Effect.map((rows) => Number(rows[0]?.count ?? 0)),
        Effect.mapError(portError("failed to count active purchases")),
      ),
  countActiveSubscriptions: (personId) =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.personId, personId),
          eq(subscriptions.status, SubscriptionStatus.Active),
        ),
      )
      .pipe(
        Effect.map((rows) => Number(rows[0]?.count ?? 0)),
        Effect.mapError(portError("failed to count active subscriptions")),
      ),
  findPerson: (id) =>
    db.query.persons
      .findFirst({
        columns: { id: true, primaryDistinctId: true, projectId: true },
        where: { id },
      })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PurchaseStateRepositoryPersonContext, row, "invalid purchase person row"),
        ),
        Effect.mapError(portError("failed to load purchase person")),
      ),
  findPublicApiToken: (projectId) =>
    db.query.apiKeys
      .findFirst({ columns: { key: true }, where: { isPublic: true, projectId } })
      .pipe(
        Effect.map((row) => row?.key),
        Effect.mapError(portError("failed to resolve public API token")),
      ),
  findPurchaseByProviderKey: (input) =>
    db.query.purchases
      .findFirst({
        where: {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          providerKey: input.providerKey,
        },
      })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PurchaseRecord, row, "invalid purchase projection row"),
        ),
        Effect.mapError(portError("failed to load purchase projection")),
      ),
  findSubscriptionByStoreSubscriptionId: (input) =>
    db.query.subscriptions.findFirst({ where: input }).pipe(
      Effect.flatMap((row) =>
        decodeOptional(PurchaseSubscriptionRecord, row, "invalid subscription projection row"),
      ),
      Effect.mapError(portError("failed to load subscription projection")),
    ),
  findSubscriptionForRenewal: (input) =>
    Effect.gen(function* () {
      const current = yield* db.query.subscriptions.findFirst({ where: input });
      if (current !== undefined) {
        return yield* decodeRequired(
          PurchaseSubscriptionRecord,
          current,
          "invalid subscription projection row",
        );
      }
      const pending = yield* db.query.subscriptions.findFirst({
        where: {
          pendingProductChangeId: input.paymentProviderConfigurationProductId,
          storeSubscriptionId: input.storeSubscriptionId,
        },
      });
      return yield* decodeOptional(
        PurchaseSubscriptionRecord,
        pending,
        "invalid subscription projection row",
      );
    }).pipe(Effect.mapError(portError("failed to load renewal subscription projection"))),
  findTransactionByProviderTransactionId: (input) =>
    db.query.transactions
      .findFirst({
        where: {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          storeTransactionId: input.storeTransactionId,
        },
      })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PurchaseTransactionRecord, row, "invalid transaction projection row"),
        ),
        Effect.mapError(portError("failed to load transaction projection")),
      ),
  insertPurchaseIfAbsent: (input) =>
    Effect.gen(function* () {
      yield* db
        .insert(purchases)
        .values(input)
        .onConflictDoNothing({
          target: [purchases.paymentProviderConfigurationProductId, purchases.providerKey],
        });
      const row = yield* db.query.purchases.findFirst({
        where: {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          providerKey: input.providerKey,
        },
      });
      if (row === undefined) return yield* Effect.fail("inserted purchase row was not readable");
      return {
        inserted: row.id === input.id,
        row: yield* decodeRequired(PurchaseRecord, row, "invalid inserted purchase row"),
      };
    }).pipe(Effect.mapError(portError("failed to insert purchase projection"))),
  insertSubscriptionIfAbsent: (input) =>
    Effect.gen(function* () {
      yield* db
        .insert(subscriptions)
        .values(input)
        .onConflictDoNothing({
          target: [
            subscriptions.paymentProviderConfigurationProductId,
            subscriptions.storeSubscriptionId,
          ],
        });
      const row = yield* db.query.subscriptions.findFirst({
        where: {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          storeSubscriptionId: input.storeSubscriptionId,
        },
      });
      if (row === undefined)
        return yield* Effect.fail("inserted subscription row was not readable");
      return {
        inserted: row.id === input.id,
        row: yield* decodeRequired(
          PurchaseSubscriptionRecord,
          row,
          "invalid inserted subscription row",
        ),
      };
    }).pipe(Effect.mapError(portError("failed to insert subscription projection"))),
  insertTransactionIfAbsent: (input) =>
    Effect.gen(function* () {
      yield* db
        .insert(transactions)
        .values(input)
        .onConflictDoNothing({
          target: [
            transactions.paymentProviderConfigurationProductId,
            transactions.storeTransactionId,
          ],
        });
      const row = yield* db.query.transactions.findFirst({
        where: {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          storeTransactionId: input.storeTransactionId,
        },
      });
      if (row === undefined) return yield* Effect.fail("inserted transaction row was not readable");
      return {
        inserted: row.id === input.id,
        row: yield* decodeRequired(
          PurchaseTransactionRecord,
          row,
          "invalid inserted transaction row",
        ),
      };
    }).pipe(Effect.mapError(portError("failed to insert transaction projection"))),
  lockPurchaseForUpdate: (id) =>
    db
      .select()
      .from(purchases)
      .where(eq(purchases.id, id))
      .for("update")
      .pipe(
        Effect.flatMap((rows) =>
          decodeOptional(PurchaseRecord, rows[0], "invalid locked purchase projection row"),
        ),
        Effect.mapError(portError("failed to lock purchase projection")),
      ),
  lockSubscriptionForUpdate: (id) =>
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .for("update")
      .pipe(
        Effect.flatMap((rows) =>
          decodeOptional(
            PurchaseSubscriptionRecord,
            rows[0],
            "invalid locked subscription projection row",
          ),
        ),
        Effect.mapError(portError("failed to lock subscription projection")),
      ),
  resolveConfigurationProduct: (id) =>
    db.query.paymentProviderConfigurationProducts
      .findFirst({ where: { id }, with: { product: true } })
      .pipe(
        Effect.flatMap((row) => {
          if (row?.product === undefined || row.product === null) return Effect.succeed(undefined);
          return decodeRequired(
            PurchaseProductContext,
            {
              id: row.id,
              paymentProviderConfigurationId: row.paymentProviderConfigurationId,
              productId: row.productId,
              productProjectId: row.product.projectId,
              productSlug: row.product.slug,
              providerProductKey: row.providerProductKey,
            },
            "invalid purchase product mapping row",
          );
        }),
        Effect.mapError(portError("failed to resolve purchase product mapping")),
      ),
  resolveDistinctId: (personId) =>
    db.query.persons
      .findFirst({ columns: { primaryDistinctId: true }, where: { id: personId } })
      .pipe(
        Effect.map((row) => row?.primaryDistinctId ?? personId),
        Effect.mapError(portError("failed to resolve purchase distinct id")),
      ),
  updatePurchaseIfFresher: (input) => {
    const { id, occurredAt, ...patch } = input;
    return db
      .update(purchases)
      .set({ ...patch, lastEventOccurredAt: occurredAt })
      .where(
        and(
          eq(purchases.id, id),
          or(isNull(purchases.lastEventOccurredAt), lte(purchases.lastEventOccurredAt, occurredAt)),
        ),
      )
      .returning({ id: purchases.id })
      .pipe(
        Effect.map((rows) => ({ affectedRows: rows.length })),
        Effect.mapError(portError("failed to update purchase projection")),
      );
  },
  updateSubscriptionIfFresher: (input) => {
    const { id, occurredAt, ...patch } = input;
    return db
      .update(subscriptions)
      .set({ ...patch, lastEventOccurredAt: occurredAt })
      .where(
        and(
          eq(subscriptions.id, id),
          or(
            isNull(subscriptions.lastEventOccurredAt),
            lte(subscriptions.lastEventOccurredAt, occurredAt),
          ),
        ),
      )
      .returning({ id: subscriptions.id })
      .pipe(
        Effect.map((rows) => ({ affectedRows: rows.length })),
        Effect.mapError(portError("failed to update subscription projection")),
      );
  },
  updateTransactionIfFresher: (input) => {
    const { id, occurredAt, ...patch } = input;
    return db
      .update(transactions)
      .set({ ...patch, lastEventOccurredAt: occurredAt })
      .where(
        and(
          eq(transactions.id, id),
          or(
            isNull(transactions.lastEventOccurredAt),
            lte(transactions.lastEventOccurredAt, occurredAt),
          ),
        ),
      )
      .returning({ id: transactions.id })
      .pipe(
        Effect.map((rows) => ({ affectedRows: rows.length })),
        Effect.mapError(portError("failed to update transaction projection")),
      );
  },
});

const PurchaseStateRepositoryPersonContext = Schema.Struct({
  id: Schema.NonEmptyString,
  primaryDistinctId: Schema.NullOr(Schema.String),
  projectId: Schema.NonEmptyString,
});

/** PostgreSQL-backed purchase-state repository. */
export const DbPurchaseStateRepositoryLive = Layer.effect(
  PurchaseStateRepository,
  Effect.gen(function* () {
    return makeDbPurchaseStateRepository(yield* Db);
  }),
);
