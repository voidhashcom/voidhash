import {
  PaymentProviderConfiguration,
  PaymentProviderConfigurations,
  PaymentProviderProduct,
  PaymentProviderProducts,
  ProjectPaymentProviderProducts,
  ProjectPermissionCheck,
  PurchaseActionForbiddenError,
  PurchaseAuditLog,
  PurchaseCatalogProduct,
  PurchaseManagementRepository,
  PurchasePortError,
  SchemaCacheInvalidation,
  type PurchaseManagementRepositoryShape,
} from "@voidhash/core-v2";
import { AuditLogPort, SchemaCacheInvalidationService } from "@voidhash/core/services";
import { generateId } from "@voidhash/core/utils/generate-id";
import { checkProjectPermission } from "@voidhash/core/utils/permissions";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  and,
  asc,
  eq,
  not,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  products,
} from "@voidhash/db";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

const auditAction = (action: "created" | "updated" | "deleted") => {
  if (action === "created") return AuditLogAction.Created;
  if (action === "updated") return AuditLogAction.Updated;
  return AuditLogAction.Deleted;
};

const auditEntityType = (
  entityType: "payment-provider-configuration" | "payment-provider-product",
) => {
  if (entityType === "payment-provider-configuration") {
    return AuditLogEntityType.PaymentProviderConfiguration;
  }
  return AuditLogEntityType.PaymentProviderProduct;
};

const decodeOptional = <S extends Schema.Top>(schema: S, value: unknown, message: string) => {
  if (value === undefined || value === null) return Effect.succeed(undefined);
  return Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError(portError(message)));
};

/** Builds provider-management persistence against a PostgreSQL connection. */
export const makeDbPurchaseManagementRepository = (
  db: typeof Db.Service,
): PurchaseManagementRepositoryShape => ({
  configurationHasMappings: (id) =>
    db.query.paymentProviderConfigurationProducts
      .findFirst({ columns: { id: true }, where: { paymentProviderConfigurationId: id } })
      .pipe(
        Effect.map((row) => row !== undefined),
        Effect.mapError(portError("failed to inspect provider configuration mappings")),
      ),
  deleteProviderProduct: (id) =>
    db
      .delete(paymentProviderConfigurationProducts)
      .where(eq(paymentProviderConfigurationProducts.id, id))
      .pipe(Effect.asVoid, Effect.mapError(portError("failed to delete provider product mapping"))),
  findActiveProviderProductByKey: (input) =>
    db.query.paymentProviderConfigurationProducts
      .findFirst({ where: { ...input, isActive: true } })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PaymentProviderProduct, row, "invalid provider product mapping row"),
        ),
        Effect.mapError(portError("failed to find active provider product mapping")),
      ),
  findConfiguration: (id) =>
    db.query.paymentProviderConfigurations
      .findFirst({ where: { id, deletedAt: { isNull: true } } })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PaymentProviderConfiguration, row, "invalid provider configuration row"),
        ),
        Effect.mapError(portError("failed to find provider configuration")),
      ),
  findConfigurationByProjectProvider: (input) =>
    db.query.paymentProviderConfigurations
      .findFirst({ where: { ...input, deletedAt: { isNull: true } } })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PaymentProviderConfiguration, row, "invalid provider configuration row"),
        ),
        Effect.mapError(portError("failed to find project provider configuration")),
      ),
  findConfigurationKeyConflict: (input) =>
    db.query.paymentProviderConfigurations
      .findFirst({
        where: {
          deletedAt: { isNull: true },
          id: { ne: input.excludeId },
          paymentProviderKey: input.paymentProviderKey,
          projectId: input.projectId,
          providerId: input.providerId,
        },
      })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PaymentProviderConfiguration, row, "invalid provider configuration row"),
        ),
        Effect.mapError(portError("failed to inspect provider configuration key")),
      ),
  findProduct: (id) =>
    db.query.products.findFirst({ columns: { id: true, projectId: true }, where: { id } }).pipe(
      Effect.flatMap((row) =>
        decodeOptional(PurchaseCatalogProduct, row, "invalid purchase catalog product row"),
      ),
      Effect.mapError(portError("failed to find purchase catalog product")),
    ),
  findProviderProduct: (id) =>
    db.query.paymentProviderConfigurationProducts.findFirst({ where: { id } }).pipe(
      Effect.flatMap((row) =>
        decodeOptional(PaymentProviderProduct, row, "invalid provider product mapping row"),
      ),
      Effect.mapError(portError("failed to find provider product mapping")),
    ),
  findProviderProductByNaturalKey: (input) =>
    db.query.paymentProviderConfigurationProducts.findFirst({ where: input }).pipe(
      Effect.flatMap((row) =>
        decodeOptional(PaymentProviderProduct, row, "invalid provider product mapping row"),
      ),
      Effect.mapError(portError("failed to find provider product mapping")),
    ),
  findScopedConfiguration: (input) => {
    if (Arr.isReadonlyArrayEmpty(input.projectIds)) return Effect.succeed(undefined);
    return db.query.paymentProviderConfigurations
      .findFirst({
        where: {
          deletedAt: { isNull: true },
          id: input.id,
          projectId: { in: [...input.projectIds] },
          providerId: { ne: "development" },
        },
      })
      .pipe(
        Effect.flatMap((row) =>
          decodeOptional(PaymentProviderConfiguration, row, "invalid provider configuration row"),
        ),
        Effect.mapError(portError("failed to find scoped provider configuration")),
      );
  },
  insertConfiguration: (input) => {
    const id = generateId("paymentProviderConfiguration");
    return db
      .insert(paymentProviderConfigurations)
      .values({ ...input, id })
      .pipe(
        Effect.as({ id }),
        Effect.mapError(portError("failed to insert provider configuration")),
      );
  },
  insertProviderProduct: (input) => {
    const id = generateId("paymentProviderProduct");
    return db
      .transaction((tx) =>
        Effect.gen(function* () {
          yield* tx
            .update(paymentProviderConfigurationProducts)
            .set({ isActive: false })
            .where(
              and(
                eq(paymentProviderConfigurationProducts.productId, input.productId),
                eq(
                  paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                  input.paymentProviderConfigurationId,
                ),
              ),
            );
          yield* tx.insert(paymentProviderConfigurationProducts).values({
            ...input,
            id,
            isActive: true,
          });
          return { id };
        }),
      )
      .pipe(Effect.mapError(portError("failed to insert provider product mapping")));
  },
  listConfigurations: (projectId) =>
    db.query.paymentProviderConfigurations
      .findMany({
        where: { deletedAt: { isNull: true }, projectId, providerId: { ne: "development" } },
      })
      .pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(PaymentProviderConfigurations)),
        Effect.mapError(portError("failed to list provider configurations")),
      ),
  listProviderProductsByProduct: (productId) =>
    db
      .select({
        configuration: paymentProviderConfigurationProducts.configuration,
        createdAt: paymentProviderConfigurationProducts.createdAt,
        id: paymentProviderConfigurationProducts.id,
        isActive: paymentProviderConfigurationProducts.isActive,
        paymentProviderConfigurationId:
          paymentProviderConfigurationProducts.paymentProviderConfigurationId,
        productId: paymentProviderConfigurationProducts.productId,
        providerProductKey: paymentProviderConfigurationProducts.providerProductKey,
        updatedAt: paymentProviderConfigurationProducts.updatedAt,
      })
      .from(paymentProviderConfigurationProducts)
      .innerJoin(
        paymentProviderConfigurations,
        eq(
          paymentProviderConfigurationProducts.paymentProviderConfigurationId,
          paymentProviderConfigurations.id,
        ),
      )
      .where(
        and(
          eq(paymentProviderConfigurationProducts.productId, productId),
          not(eq(paymentProviderConfigurations.providerId, "development")),
        ),
      )
      .orderBy(asc(paymentProviderConfigurationProducts.createdAt))
      .pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(PaymentProviderProducts)),
        Effect.mapError(portError("failed to list product provider mappings")),
      ),
  listProviderProductsByProject: (projectId) =>
    db
      .select()
      .from(paymentProviderConfigurationProducts)
      .innerJoin(products, eq(paymentProviderConfigurationProducts.productId, products.id))
      .innerJoin(
        paymentProviderConfigurations,
        eq(
          paymentProviderConfigurationProducts.paymentProviderConfigurationId,
          paymentProviderConfigurations.id,
        ),
      )
      .where(
        and(
          eq(products.projectId, projectId),
          not(eq(paymentProviderConfigurations.providerId, "development")),
        ),
      )
      .orderBy(asc(paymentProviderConfigurationProducts.createdAt))
      .pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            configuration: row.payment_provider_configuration_product.configuration,
            id: row.payment_provider_configuration_product.id,
            paymentProviderConfigurationId:
              row.payment_provider_configuration_product.paymentProviderConfigurationId,
            productId: row.payment_provider_configuration_product.productId,
            providerId: row.payment_provider_configuration.providerId,
          })),
        ),
        Effect.flatMap(Schema.decodeUnknownEffect(ProjectPaymentProviderProducts)),
        Effect.mapError(portError("failed to list project provider mappings")),
      ),
  providerProductHasHistory: (id) =>
    Effect.all([
      db.query.checkoutSessions.findFirst({
        columns: { id: true },
        where: { paymentProviderConfigurationProductId: id },
      }),
      db.query.purchases.findFirst({
        columns: { id: true },
        where: { paymentProviderConfigurationProductId: id },
      }),
      db.query.subscriptions.findFirst({
        columns: { id: true },
        where: { paymentProviderConfigurationProductId: id },
      }),
      db.query.transactions.findFirst({
        columns: { id: true },
        where: { paymentProviderConfigurationProductId: id },
      }),
    ], { concurrency: 1 }).pipe(
      Effect.map((references) => references.some((reference) => reference !== undefined)),
      Effect.mapError(portError("failed to inspect provider product history")),
    ),
  setActiveProviderProduct: (input) =>
    db
      .transaction((tx) =>
        Effect.gen(function* () {
          yield* tx
            .update(paymentProviderConfigurationProducts)
            .set({ isActive: false })
            .where(
              and(
                eq(paymentProviderConfigurationProducts.productId, input.productId),
                eq(
                  paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                  input.paymentProviderConfigurationId,
                ),
                not(eq(paymentProviderConfigurationProducts.id, input.id)),
              ),
            );
          yield* tx
            .update(paymentProviderConfigurationProducts)
            .set({ isActive: true })
            .where(eq(paymentProviderConfigurationProducts.id, input.id));
        }),
      )
      .pipe(Effect.mapError(portError("failed to activate provider product mapping"))),
  softDeleteConfiguration: (id) =>
    Effect.gen(function* () {
      const deletedAt = yield* DateTime.nowAsDate;
      yield* db
        .update(paymentProviderConfigurations)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(eq(paymentProviderConfigurations.id, id));
    }).pipe(Effect.asVoid, Effect.mapError(portError("failed to delete provider configuration"))),
  updateConfiguration: (input) => {
    const { id, ...update } = input;
    return Effect.gen(function* () {
      const updatedAt = yield* DateTime.nowAsDate;
      yield* db
        .update(paymentProviderConfigurations)
        .set({ ...update, updatedAt })
        .where(eq(paymentProviderConfigurations.id, id));
    }).pipe(Effect.mapError(portError("failed to update provider configuration")));
  },
  updateProviderProduct: (input) =>
    db
      .update(paymentProviderConfigurationProducts)
      .set({
        configuration: input.configuration,
        providerProductKey: input.providerProductKey,
      })
      .where(eq(paymentProviderConfigurationProducts.id, input.id))
      .pipe(Effect.asVoid, Effect.mapError(portError("failed to update provider product mapping"))),
});

/** PostgreSQL implementation of the provider-management repository. */
export const DbPurchaseManagementRepositoryLive = Layer.effect(
  PurchaseManagementRepository,
  Effect.gen(function* () {
    return makeDbPurchaseManagementRepository(yield* Db);
  }),
);

/** Adapter from purchase audit entries to the shared append-only audit log. */
export const PurchaseAuditLogLive = Layer.effect(
  PurchaseAuditLog,
  Effect.gen(function* () {
    const audit = yield* AuditLogPort;
    return PurchaseAuditLog.of({
      append: (entry) =>
        audit
          .append({
            ...entry,
            action: auditAction(entry.action),
            entityType: auditEntityType(entry.entityType),
          })
          .pipe(Effect.mapError(portError("failed to append purchase audit entry"))),
    });
  }),
);

/** Adapter for request-scoped project administration checks. */
export const ProjectPermissionCheckLive = Layer.succeed(ProjectPermissionCheck, {
  requireProjectAll: (projectId, message) =>
    checkProjectPermission(projectId, "project:all", message).pipe(
      Effect.catchTag("ActionForbiddenError", (error) =>
        Effect.fail(new PurchaseActionForbiddenError({ message: error.message })),
      ),
    ),
});

/** Adapter for invalidating project schemas after purchase catalog writes. */
export const SchemaCacheInvalidationLive = Layer.effect(
  SchemaCacheInvalidation,
  Effect.gen(function* () {
    const cache = yield* SchemaCacheInvalidationService;
    return SchemaCacheInvalidation.of({
      invalidate: (projectId) =>
        cache
          .invalidate(projectId)
          .pipe(
            Effect.catchCause((cause) =>
              Effect.fail(
                new PurchasePortError({
                  cause,
                  message: "failed to invalidate purchase schema cache",
                }),
              ),
            ),
          ),
    });
  }),
);
