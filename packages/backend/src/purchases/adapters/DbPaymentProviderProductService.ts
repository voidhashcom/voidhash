import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import {
  PaymentProviderProductNotFoundError,
  PaymentProviderProductValidationError,
} from "@voidhash/core-v2";
import * as Workflow from "@voidhash/platform/Workflow";
import {
  AppStoreReplayParkedNotifications,
  GooglePlayReplayParkedNotifications,
  StripeReplayParkedNotifications,
} from "@voidhash/core-v2";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  type Product as DbProduct,
  and,
  asc,
  eq,
  not,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  products,
} from "@voidhash/db";
import { generateId } from "@voidhash/core/utils/generate-id";
import { checkProjectPermission } from "@voidhash/core/utils/permissions";
import { AuditLogPort, SchemaCacheInvalidationService } from "@voidhash/core/services";
import {
  AppStorePaymentProvider,
  type AnyPaymentProviderShape,
  GooglePlayPaymentProvider,
  StripePaymentProvider,
} from "@voidhash/core-v2";

/**
 * Catch-all service error. Wraps `DbError` and other infrastructural
 * failures at the public-method boundary.
 */
export class PaymentProviderProductServiceError extends Schema.TaggedErrorClass<PaymentProviderProductServiceError>(
  "PaymentProviderProductServiceError",
)("PaymentProviderProductServiceError", { cause: Schema.String }) {}

/**
 * `PaymentProviderProductService` orchestrates the per-product, per-provider
 * mapping rows that link catalog products to provider-specific product keys.
 *
 * `AuditLogPort`, `AuthSession`, `Db`, `SchemaCacheInvalidationService`,
 * the three `PaymentProvider` adapter stubs, and the
 * `AppStoreReplayParkedNotificationsWorkflow` /
 * `GooglePlayReplayParkedNotificationsWorkflow` /
 * `StripeReplayParkedNotificationsWorkflow` bindings are provided by the
 * application root.
 */
export class PaymentProviderProductService extends Context.Service<PaymentProviderProductService>()(
  "@voidhash/backend/purchases/PaymentProviderProductService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const schemaCache = yield* SchemaCacheInvalidationService;
      const stripePaymentProvider = yield* StripePaymentProvider;
      const appStorePaymentProvider = yield* AppStorePaymentProvider;
      const googlePlayPaymentProvider = yield* GooglePlayPaymentProvider;
      const db = yield* Db;

      const paymentProviders: ReadonlyArray<AnyPaymentProviderShape> = [
        stripePaymentProvider,
        appStorePaymentProvider,
        googlePlayPaymentProvider,
      ];

      const validateSameProject = (input: {
        readonly configurationProjectId: string;
        readonly productProjectId: string;
      }) => {
        if (input.configurationProjectId === input.productProjectId) return Effect.void;
        return Effect.fail(
          new PaymentProviderProductValidationError({
            message: "Product and payment provider configuration must belong to the same project",
          }),
        );
      };

      const validateActiveProviderKeyAvailable = Effect.fn("validateActiveProviderKeyAvailable")(
        function* (input: {
          readonly paymentProviderConfigurationId: string;
          readonly productId: string;
          readonly providerProductKey: string;
          readonly excludeId?: string;
        }) {
          const active = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: {
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              providerProductKey: input.providerProductKey,
              isActive: true,
            },
          });
          if (active && active.id !== input.excludeId && active.productId !== input.productId) {
            return yield* new PaymentProviderProductValidationError({
              message: `Provider product key ${input.providerProductKey} is already mapped to another product`,
            });
          }
        },
      );

      const findProvider = (
        providerId: string,
      ): Effect.Effect<AnyPaymentProviderShape, PaymentProviderProductValidationError> => {
        const provider = paymentProviders.find((candidate) => candidate.id === providerId);
        if (provider) return Effect.succeed(provider);
        return Effect.fail(
          new PaymentProviderProductValidationError({
            message: `Payment provider ${providerId} not found`,
          }),
        );
      };

      /**
       * Background-schedules the App Store parked-notification replay
       * workflow when a new `(configurationId, providerProductKey)` mapping
       * exists.
       */
      const scheduleAppStoreParkedReplayIfApplicable = (input: {
        readonly providerId: string;
        readonly paymentProviderConfigurationId: string;
        readonly paymentProviderProductId: string;
        readonly providerProductKey: string;
      }) =>
        Effect.gen(function* () {
          if (input.providerId !== "apple-app-store") {
            return;
          }
          const requestedAt = DateTime.formatIso(yield* DateTime.now);
          yield* Workflow.dispatch(AppStoreReplayParkedNotifications, {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: input.paymentProviderProductId,
            providerProductKey: input.providerProductKey,
            requestedAt,
          }).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule App Store parked replay", { error }),
            ),
            Effect.ignore,
          );
        });

      /**
       * Background-schedules the Google Play parked-notification replay
       * workflow when a new `(configurationId, providerProductKey)` mapping
       * exists. Fire-and-forget — the Google analogue of
       * {@link scheduleAppStoreParkedReplayIfApplicable}, gated on the
       * `google-play` provider.
       */
      const scheduleGooglePlayParkedReplayIfApplicable = (input: {
        readonly providerId: string;
        readonly paymentProviderConfigurationId: string;
        readonly paymentProviderProductId: string;
        readonly providerProductKey: string;
      }) =>
        Effect.gen(function* () {
          if (input.providerId !== "google-play") {
            return;
          }
          const requestedAt = DateTime.formatIso(yield* DateTime.now);
          yield* Workflow.dispatch(GooglePlayReplayParkedNotifications, {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: input.paymentProviderProductId,
            providerProductKey: input.providerProductKey,
            requestedAt,
          }).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule Google Play parked replay", { error }),
            ),
            Effect.ignore,
          );
        });

      /**
       * Background-schedules the Stripe parked-event replay workflow when a new
       * `(configurationId, providerProductKey)` mapping exists, so events that
       * arrived before the product was mapped get reprocessed. Fire-and-forget.
       */
      const scheduleStripeParkedReplayIfApplicable = (input: {
        readonly providerId: string;
        readonly paymentProviderConfigurationId: string;
        readonly paymentProviderProductId: string;
        readonly providerProductKey: string;
      }) =>
        Effect.gen(function* () {
          if (input.providerId !== "stripe") {
            return;
          }
          const requestedAt = DateTime.formatIso(yield* DateTime.now);
          yield* Workflow.dispatch(StripeReplayParkedNotifications, {
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: input.paymentProviderProductId,
            providerProductKey: input.providerProductKey,
            requestedAt,
          }).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule Stripe parked replay", { error }),
            ),
            Effect.ignore,
          );
        });

      const getProviderProductsByProjectId = Effect.fn("getProviderProductsByProjectId")(
        function* (projectId: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          yield* checkProjectPermission(
            projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access provider products for project ${projectId}`,
          );
          const rows = yield* db
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
            .orderBy(asc(paymentProviderConfigurationProducts.createdAt));
          return rows.map((row) => ({
            configuration: row.payment_provider_configuration_product.configuration,
            id: row.payment_provider_configuration_product.id,
            paymentProviderConfigurationId:
              row.payment_provider_configuration_product.paymentProviderConfigurationId,
            productId: row.payment_provider_configuration_product.productId,
            providerId: row.payment_provider_configuration.providerId,
          }));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getProviderProductsByProductId = Effect.fn("getProviderProductsByProductId")(
        function* (productId: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product.id", productId);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const product = yield* db.query.products.findFirst({ where: { id: productId } });
          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({ message: "Product not found" }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access provider products for product ${productId}`,
          );
          const rows = yield* db
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
            .orderBy(asc(paymentProviderConfigurationProducts.createdAt));
          return rows;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getProviderProductById = Effect.fn("getProviderProductById")(
        function* (id: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", id);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const providerProduct = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: { id },
          });
          if (!providerProduct) {
            return yield* Effect.fail(
              new PaymentProviderProductNotFoundError({
                message: "Provider product not found",
              }),
            );
          }
          const providerConfiguration = yield* db.query.paymentProviderConfigurations.findFirst({
            where: {
              id: providerProduct.paymentProviderConfigurationId,
              providerId: { ne: "development" },
            },
          });
          if (!providerConfiguration) {
            return yield* Effect.fail(
              new PaymentProviderProductNotFoundError({ message: "Provider product not found" }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.product.id", providerProduct.productId);
          const product = yield* db.query.products.findFirst({
            where: { id: providerProduct.productId },
          });
          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Product ${providerProduct.productId} not found`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access provider product for project ${product.projectId}`,
          );
          return providerProduct;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const createPaymentProviderProduct = Effect.fn("createPaymentProviderProduct")(
        function* (input: {
          readonly productId: string;
          readonly paymentProviderConfigurationId: string;
          readonly configuration: Record<string, unknown>;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product.id", input.productId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const [product, providerConfiguration] = yield* Effect.all(
            [
              db.query.products.findFirst({ where: { id: input.productId } }),
              db.query.paymentProviderConfigurations.findFirst({
                where: { id: input.paymentProviderConfigurationId },
              }),
            ],
            { concurrency: "unbounded" },
          );

          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Product ${input.productId} not found`,
              }),
            );
          }
          if (!providerConfiguration || providerConfiguration.providerId === "development") {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
              }),
            );
          }

          yield* validateSameProject({
            configurationProjectId: providerConfiguration.projectId,
            productProjectId: product.projectId,
          });

          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            providerConfiguration.providerId,
          );

          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create payment provider products for project ${product.projectId}`,
          );
          yield* checkProjectPermission(
            providerConfiguration.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`,
          );

          const provider = yield* findProvider(providerConfiguration.providerId);
          const validation = yield* provider.validateProductConfiguration(input.configuration);
          yield* validateActiveProviderKeyAvailable({
            paymentProviderConfigurationId: providerConfiguration.id,
            productId: product.id,
            providerProductKey: validation.productKey,
          });

          const id = generateId("paymentProviderProduct");
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", id);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(paymentProviderConfigurationProducts)
                .set({ isActive: false })
                .where(
                  and(
                    eq(paymentProviderConfigurationProducts.productId, product.id),
                    eq(
                      paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                      input.paymentProviderConfigurationId,
                    ),
                  ),
                );
              yield* tx.insert(paymentProviderConfigurationProducts).values({
                configuration: validation.parsedConfiguration,
                id,
                isActive: true,
                paymentProviderConfigurationId: providerConfiguration.id,
                productId: product.id,
                providerProductKey: validation.productKey,
              });
            }),
          );

          yield* auditLog
            .append({
              projectId: product.projectId,
              entityType: AuditLogEntityType.PaymentProviderProduct,
              entityId: id,
              parentEntityId: input.productId,
              action: AuditLogAction.Created,
            })
            .pipe(Effect.ignore);

          yield* Effect.log(`Created payment provider product ${id} for product ${product.id}`);
          yield* schemaCache.invalidate(product.projectId);

          yield* scheduleAppStoreParkedReplayIfApplicable({
            paymentProviderConfigurationId: providerConfiguration.id,
            paymentProviderProductId: id,
            providerId: providerConfiguration.providerId,
            providerProductKey: validation.productKey,
          });
          yield* scheduleGooglePlayParkedReplayIfApplicable({
            paymentProviderConfigurationId: providerConfiguration.id,
            paymentProviderProductId: id,
            providerId: providerConfiguration.providerId,
            providerProductKey: validation.productKey,
          });
          yield* scheduleStripeParkedReplayIfApplicable({
            paymentProviderConfigurationId: providerConfiguration.id,
            paymentProviderProductId: id,
            providerId: providerConfiguration.providerId,
            providerProductKey: validation.productKey,
          });

          return { id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const setActivePaymentProviderProduct = Effect.fn("setActivePaymentProviderProduct")(
        function* (input: {
          readonly productId: string;
          readonly providerProductKey: string;
          readonly paymentProviderConfigurationId: string;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product.id", input.productId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.provider_product_key",
            input.providerProductKey,
          );
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }

          const [product, providerConfiguration] = yield* Effect.all([
            db.query.products.findFirst({ where: { id: input.productId } }),
            db.query.paymentProviderConfigurations.findFirst({
              where: { id: input.paymentProviderConfigurationId },
            }),
          ]);

          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Product ${input.productId} not found`,
              }),
            );
          }
          if (!providerConfiguration || providerConfiguration.providerId === "development") {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
              }),
            );
          }

          yield* validateSameProject({
            configurationProjectId: providerConfiguration.projectId,
            productProjectId: product.projectId,
          });

          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            providerConfiguration.providerId,
          );

          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`,
          );
          yield* checkProjectPermission(
            providerConfiguration.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access payment provider configuration for project ${providerConfiguration.projectId}`,
          );

          yield* findProvider(providerConfiguration.providerId);

          const target = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: {
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              productId: input.productId,
              providerProductKey: input.providerProductKey,
            },
          });
          if (!target) {
            return yield* new PaymentProviderProductValidationError({
              message: `Provider product key ${input.providerProductKey} is not configured for this product`,
            });
          }
          yield* validateActiveProviderKeyAvailable({
            excludeId: target.id,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            productId: input.productId,
            providerProductKey: input.providerProductKey,
          });

          yield* db.transaction((tx) =>
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
                    not(
                      eq(
                        paymentProviderConfigurationProducts.providerProductKey,
                        input.providerProductKey,
                      ),
                    ),
                  ),
                );
              yield* tx
                .update(paymentProviderConfigurationProducts)
                .set({ isActive: true })
                .where(
                  and(
                    eq(paymentProviderConfigurationProducts.productId, input.productId),
                    eq(
                      paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                      input.paymentProviderConfigurationId,
                    ),
                    eq(
                      paymentProviderConfigurationProducts.providerProductKey,
                      input.providerProductKey,
                    ),
                  ),
                );
            }),
          );

          yield* auditLog
            .append({
              projectId: product.projectId,
              entityType: AuditLogEntityType.PaymentProviderProduct,
              entityId: input.productId,
              action: AuditLogAction.Updated,
              changes: { providerProductKey: input.providerProductKey },
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(product.projectId);

          yield* scheduleAppStoreParkedReplayIfApplicable({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: target.id,
            providerId: providerConfiguration.providerId,
            providerProductKey: input.providerProductKey,
          });
          yield* scheduleGooglePlayParkedReplayIfApplicable({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: target.id,
            providerId: providerConfiguration.providerId,
            providerProductKey: input.providerProductKey,
          });
          yield* scheduleStripeParkedReplayIfApplicable({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderProductId: target.id,
            providerId: providerConfiguration.providerId,
            providerProductKey: input.providerProductKey,
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const updatePaymentProviderProduct = Effect.fn("updatePaymentProviderProduct")(
        function* (input: {
          readonly id: string;
          readonly configuration: Record<string, unknown>;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", input.id);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const providerProduct = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: { id: input.id },
          });
          if (!providerProduct) {
            return yield* Effect.fail(
              new PaymentProviderProductNotFoundError({
                message: "Provider product not found",
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.product.id", providerProduct.productId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            providerProduct.paymentProviderConfigurationId,
          );

          const [product, providerConfiguration] = yield* Effect.all([
            db.query.products.findFirst({ where: { id: providerProduct.productId } }),
            db.query.paymentProviderConfigurations.findFirst({
              where: { id: providerProduct.paymentProviderConfigurationId },
            }),
          ]);
          if (!product) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Product ${providerProduct.productId} not found`,
              }),
            );
          }
          if (!providerConfiguration || providerConfiguration.providerId === "development") {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${providerProduct.paymentProviderConfigurationId} not found`,
              }),
            );
          }

          yield* validateSameProject({
            configurationProjectId: providerConfiguration.projectId,
            productProjectId: product.projectId,
          });

          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            providerConfiguration.providerId,
          );

          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update payment provider products for project ${product.projectId}`,
          );

          const provider = yield* findProvider(providerConfiguration.providerId);
          const validation = yield* provider.validateProductConfiguration(input.configuration);
          yield* validateActiveProviderKeyAvailable({
            excludeId: providerProduct.id,
            paymentProviderConfigurationId: providerProduct.paymentProviderConfigurationId,
            productId: providerProduct.productId,
            providerProductKey: validation.productKey,
          });

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .update(paymentProviderConfigurationProducts)
                .set({
                  configuration: validation.parsedConfiguration,
                  providerProductKey: validation.productKey,
                })
                .where(eq(paymentProviderConfigurationProducts.id, providerProduct.id));
            }),
          );

          yield* auditLog
            .append({
              projectId: product.projectId,
              entityType: AuditLogEntityType.PaymentProviderProduct,
              entityId: providerProduct.id,
              parentEntityId: providerProduct.productId,
              action: AuditLogAction.Updated,
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(product.projectId);

          if (
            providerProduct.isActive &&
            providerProduct.providerProductKey !== validation.productKey
          ) {
            yield* scheduleAppStoreParkedReplayIfApplicable({
              paymentProviderConfigurationId: providerConfiguration.id,
              paymentProviderProductId: providerProduct.id,
              providerId: providerConfiguration.providerId,
              providerProductKey: validation.productKey,
            });
            yield* scheduleGooglePlayParkedReplayIfApplicable({
              paymentProviderConfigurationId: providerConfiguration.id,
              paymentProviderProductId: providerProduct.id,
              providerId: providerConfiguration.providerId,
              providerProductKey: validation.productKey,
            });
            yield* scheduleStripeParkedReplayIfApplicable({
              paymentProviderConfigurationId: providerConfiguration.id,
              paymentProviderProductId: providerProduct.id,
              providerId: providerConfiguration.providerId,
              providerProductKey: validation.productKey,
            });
          }
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const deletePaymentProviderProduct = Effect.fn("deletePaymentProviderProduct")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", input.id);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const providerProduct = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: { id: input.id },
            with: { product: true },
          });
          if (!providerProduct) {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Payment provider product ${input.id} not found`,
              }),
            );
          }
          const providerConfiguration = yield* db.query.paymentProviderConfigurations.findFirst({
            where: { id: providerProduct.paymentProviderConfigurationId },
          });
          if (!providerConfiguration || providerConfiguration.providerId === "development") {
            return yield* Effect.fail(
              new PaymentProviderProductValidationError({
                message: `Payment provider product ${input.id} not found`,
              }),
            );
          }
          // A missing joined product is a broken catalog invariant.
          const product: DbProduct | null = providerProduct.product;
          if (!product) {
            return yield* Effect.die(
              new Error(`Payment provider product ${input.id} has no catalog product`),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.product.id", providerProduct.productId);
          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to delete payment provider products for project ${product.projectId}`,
          );

          const references = yield* Effect.all(
            [
              db.query.checkoutSessions.findFirst({
                columns: { id: true },
                where: { paymentProviderConfigurationProductId: input.id },
              }),
              db.query.purchases.findFirst({
                columns: { id: true },
                where: { paymentProviderConfigurationProductId: input.id },
              }),
              db.query.subscriptions.findFirst({
                columns: { id: true },
                where: { paymentProviderConfigurationProductId: input.id },
              }),
              db.query.transactions.findFirst({
                columns: { id: true },
                where: { paymentProviderConfigurationProductId: input.id },
              }),
            ],
            { concurrency: "unbounded" },
          );
          if (references.some(Boolean)) {
            return yield* new PaymentProviderProductValidationError({
              message: "Provider product mappings with purchase history cannot be deleted",
            });
          }

          yield* db
            .delete(paymentProviderConfigurationProducts)
            .where(eq(paymentProviderConfigurationProducts.id, input.id));

          yield* auditLog
            .append({
              projectId: product.projectId,
              entityType: AuditLogEntityType.PaymentProviderProduct,
              entityId: input.id,
              parentEntityId: providerProduct.productId,
              action: AuditLogAction.Deleted,
            })
            .pipe(Effect.ignore);

          yield* schemaCache.invalidate(product.projectId);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaymentProviderProductServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({
        createPaymentProviderProduct,
        deletePaymentProviderProduct,
        getProviderProductById,
        getProviderProductsByProductId,
        getProviderProductsByProjectId,
        setActivePaymentProviderProduct,
        updatePaymentProviderProduct,
      });
    }),
  },
) {
  static layer = Layer.effect(PaymentProviderProductService)(PaymentProviderProductService.make);
}
