import * as P from "effect/Predicate";
import * as Workflow from "@voidhash/platform/Workflow";
import { AuthSession } from "@voidhash/rpc";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  PaymentProviderProductOperations,
  ProjectPermissionCheck,
  PurchaseAuditLog,
  PurchaseManagementRepository,
  type PurchasePortError,
  SchemaCacheInvalidation,
} from "../../application/ports.ts";
import {
  PaymentProviderProductNotFoundError,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError,
} from "../../domain/ProviderProduct.ts";
import {
  AppStorePaymentProvider,
  GooglePlayPaymentProvider,
  StripePaymentProvider,
  type AnyPaymentProviderShape,
} from "./PurchaseProviderRegistry.ts";
import {
  AppStoreReplayParkedNotifications,
  GooglePlayReplayParkedNotifications,
  StripeReplayParkedNotifications,
} from "../../runtime/workflows/definitions.ts";

const portErrorMessage = (error: PurchasePortError | { readonly _tag: unknown }) => {
  if ("message" in error && P.isString(error.message)) return error.message;
  return "Purchase persistence operation failed";
};

const annotateUser = (session: typeof AuthSession.Service) => {
  if (session.user?.id === undefined) return Effect.void;
  return Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
};

const makePaymentProviderProductOperations = Effect.fn("makePaymentProviderProductOperations")(
  function* () {
    const repository = yield* PurchaseManagementRepository;
    const audit = yield* PurchaseAuditLog;
    const permission = yield* ProjectPermissionCheck;
    const cache = yield* SchemaCacheInvalidation;
    const providers: ReadonlyArray<AnyPaymentProviderShape> = [
      yield* StripePaymentProvider,
      yield* AppStorePaymentProvider,
      yield* GooglePlayPaymentProvider,
    ];

    const mapPortError = <A, E, R>(effect: Effect.Effect<A, E | PurchasePortError, R>) =>
      effect.pipe(
        Effect.catchTag("PurchasePortError", (error) =>
          Effect.fail(
            new PaymentProviderProductServiceError({
              cause: portErrorMessage(error),
            }),
          ),
        ),
      );

    const findProvider = (providerId: string) => {
      const provider = providers.find((candidate) => candidate.id === providerId);
      if (provider !== undefined) return Effect.succeed(provider);
      return Effect.fail(
        new PaymentProviderProductValidationError({
          message: `Payment provider ${providerId} not found`,
        }),
      );
    };

    const validateSameProject = (configurationProjectId: string, productProjectId: string) => {
      if (configurationProjectId === productProjectId) return Effect.void;
      return Effect.fail(
        new PaymentProviderProductValidationError({
          message: "Product and payment provider configuration must belong to the same project",
        }),
      );
    };

    const validateActiveProviderKeyAvailable = (input: {
      readonly excludeId?: string;
      readonly paymentProviderConfigurationId: string;
      readonly productId: string;
      readonly providerProductKey: string;
    }) =>
      Effect.gen(function* () {
        const active = yield* repository.findActiveProviderProductByKey({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          providerProductKey: input.providerProductKey,
        });
        if (
          active !== undefined &&
          active.id !== input.excludeId &&
          active.productId !== input.productId
        ) {
          return yield* new PaymentProviderProductValidationError({
            message: `Provider product key ${input.providerProductKey} is already mapped to another product`,
          });
        }
      });

    const scheduleReplay = (input: {
      readonly paymentProviderConfigurationId: string;
      readonly paymentProviderProductId: string;
      readonly providerId: string;
      readonly providerProductKey: string;
    }) =>
      Effect.gen(function* () {
        const requestedAt = DateTime.formatIso(yield* DateTime.now);
        const payload = {
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          paymentProviderProductId: input.paymentProviderProductId,
          providerProductKey: input.providerProductKey,
          requestedAt,
        };
        if (input.providerId === "apple-app-store") {
          yield* Workflow.dispatch(AppStoreReplayParkedNotifications, payload).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule App Store parked replay", { error }),
            ),
            Effect.ignore,
          );
        } else if (input.providerId === "google-play") {
          yield* Workflow.dispatch(GooglePlayReplayParkedNotifications, payload).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule Google Play parked replay", { error }),
            ),
            Effect.ignore,
          );
        } else if (input.providerId === "stripe") {
          yield* Workflow.dispatch(StripeReplayParkedNotifications, payload).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Failed to schedule Stripe parked replay", { error }),
            ),
            Effect.ignore,
          );
        }
      });

    return PaymentProviderProductOperations.of({
      createPaymentProviderProduct: (input) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.configuration_id": input.paymentProviderConfigurationId,
              "voidhash.product.id": input.productId,
            });
            yield* annotateUser(session);
            const [product, configuration] = yield* Effect.all(
              [
                repository.findProduct(input.productId),
                repository.findConfiguration(input.paymentProviderConfigurationId),
              ],
              { concurrency: 1 },
            );
            if (product === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Product ${input.productId} not found`,
              });
            }
            if (configuration === undefined || configuration.providerId === "development") {
              return yield* new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.id": configuration.providerId,
              "voidhash.project.id": product.projectId,
            });
            yield* validateSameProject(configuration.projectId, product.projectId);
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to create payment provider products for project ${product.projectId}`,
            );
            yield* permission.requireProjectAll(
              configuration.projectId,
              `User ${session.user?.id} is not authorized to access payment provider configuration for project ${configuration.projectId}`,
            );
            const provider = yield* findProvider(configuration.providerId);
            const validation = yield* provider.validateProductConfiguration(input.configuration);
            yield* validateActiveProviderKeyAvailable({
              paymentProviderConfigurationId: configuration.id,
              productId: product.id,
              providerProductKey: validation.productKey,
            });
            const created = yield* repository.insertProviderProduct({
              configuration: validation.parsedConfiguration,
              paymentProviderConfigurationId: configuration.id,
              productId: product.id,
              providerProductKey: validation.productKey,
            });
            yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", created.id);
            yield* audit
              .append({
                action: "created",
                entityId: created.id,
                entityType: "payment-provider-product",
                parentEntityId: product.id,
                projectId: product.projectId,
              })
              .pipe(Effect.ignore);
            yield* cache.invalidate(product.projectId);
            yield* scheduleReplay({
              paymentProviderConfigurationId: configuration.id,
              paymentProviderProductId: created.id,
              providerId: configuration.providerId,
              providerProductKey: validation.productKey,
            });
            return created;
          }),
        ),
      deletePaymentProviderProduct: (input) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", input.id);
            yield* annotateUser(session);
            const mapping = yield* repository.findProviderProduct(input.id);
            if (mapping === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Payment provider product ${input.id} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.configuration_id": mapping.paymentProviderConfigurationId,
              "voidhash.product.id": mapping.productId,
            });
            const [configuration, product] = yield* Effect.all(
              [
                repository.findConfiguration(mapping.paymentProviderConfigurationId),
                repository.findProduct(mapping.productId),
              ],
              { concurrency: 1 },
            );
            if (
              configuration === undefined ||
              configuration.providerId === "development" ||
              product === undefined
            ) {
              return yield* new PaymentProviderProductValidationError({
                message: `Payment provider product ${input.id} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.id": configuration.providerId,
              "voidhash.project.id": product.projectId,
            });
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to delete payment provider products for project ${product.projectId}`,
            );
            if (yield* repository.providerProductHasHistory(input.id)) {
              return yield* new PaymentProviderProductValidationError({
                message: "Provider product mappings with purchase history cannot be deleted",
              });
            }
            yield* repository.deleteProviderProduct(input.id);
            yield* audit
              .append({
                action: "deleted",
                entityId: input.id,
                entityType: "payment-provider-product",
                parentEntityId: mapping.productId,
                projectId: product.projectId,
              })
              .pipe(Effect.ignore);
            yield* cache.invalidate(product.projectId);
          }),
        ),
      getProviderProductById: (id) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", id);
            yield* annotateUser(session);
            const mapping = yield* repository.findProviderProduct(id);
            if (mapping === undefined) {
              return yield* new PaymentProviderProductNotFoundError({
                message: "Provider product not found",
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.configuration_id": mapping.paymentProviderConfigurationId,
              "voidhash.product.id": mapping.productId,
            });
            const [configuration, product] = yield* Effect.all(
              [
                repository.findConfiguration(mapping.paymentProviderConfigurationId),
                repository.findProduct(mapping.productId),
              ],
              { concurrency: 1 },
            );
            if (configuration === undefined || configuration.providerId === "development") {
              return yield* new PaymentProviderProductNotFoundError({
                message: "Provider product not found",
              });
            }
            if (product === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Product ${mapping.productId} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.id": configuration.providerId,
              "voidhash.project.id": product.projectId,
            });
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to access provider product for project ${product.projectId}`,
            );
            return mapping;
          }),
        ),
      getProviderProductsByProductId: (productId) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan("voidhash.product.id", productId);
            yield* annotateUser(session);
            const product = yield* repository.findProduct(productId);
            if (product === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: "Product not found",
              });
            }
            yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to access provider products for product ${productId}`,
            );
            return yield* repository.listProviderProductsByProduct(productId);
          }),
        ),
      getProviderProductsByProjectId: (projectId) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* annotateUser(session);
            yield* permission.requireProjectAll(
              projectId,
              `User ${session.user?.id} is not authorized to access provider products for project ${projectId}`,
            );
            return yield* repository.listProviderProductsByProject(projectId);
          }),
        ),
      setActivePaymentProviderProduct: (input) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.configuration_id": input.paymentProviderConfigurationId,
              "voidhash.payment_provider.provider_product_key": input.providerProductKey,
              "voidhash.product.id": input.productId,
            });
            yield* annotateUser(session);
            const [product, configuration] = yield* Effect.all(
              [
                repository.findProduct(input.productId),
                repository.findConfiguration(input.paymentProviderConfigurationId),
              ],
              { concurrency: 1 },
            );
            if (product === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Product ${input.productId} not found`,
              });
            }
            if (configuration === undefined || configuration.providerId === "development") {
              return yield* new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${input.paymentProviderConfigurationId} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.id": configuration.providerId,
              "voidhash.project.id": product.projectId,
            });
            yield* validateSameProject(configuration.projectId, product.projectId);
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to update payment provider products for project ${product.projectId}`,
            );
            yield* permission.requireProjectAll(
              configuration.projectId,
              `User ${session.user?.id} is not authorized to access payment provider configuration for project ${configuration.projectId}`,
            );
            yield* findProvider(configuration.providerId);
            const target = yield* repository.findProviderProductByNaturalKey(input);
            if (target === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Provider product key ${input.providerProductKey} is not configured for this product`,
              });
            }
            yield* validateActiveProviderKeyAvailable({ ...input, excludeId: target.id });
            yield* repository.setActiveProviderProduct({
              id: target.id,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              productId: input.productId,
            });
            yield* audit
              .append({
                action: "updated",
                changes: { providerProductKey: input.providerProductKey },
                entityId: input.productId,
                entityType: "payment-provider-product",
                projectId: product.projectId,
              })
              .pipe(Effect.ignore);
            yield* cache.invalidate(product.projectId);
            yield* scheduleReplay({
              paymentProviderConfigurationId: configuration.id,
              paymentProviderProductId: target.id,
              providerId: configuration.providerId,
              providerProductKey: input.providerProductKey,
            });
          }),
        ),
      updatePaymentProviderProduct: (input) =>
        mapPortError(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", input.id);
            yield* annotateUser(session);
            const mapping = yield* repository.findProviderProduct(input.id);
            if (mapping === undefined) {
              return yield* new PaymentProviderProductNotFoundError({
                message: "Provider product not found",
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.configuration_id": mapping.paymentProviderConfigurationId,
              "voidhash.product.id": mapping.productId,
            });
            const [product, configuration] = yield* Effect.all(
              [
                repository.findProduct(mapping.productId),
                repository.findConfiguration(mapping.paymentProviderConfigurationId),
              ],
              { concurrency: 1 },
            );
            if (product === undefined) {
              return yield* new PaymentProviderProductValidationError({
                message: `Product ${mapping.productId} not found`,
              });
            }
            if (configuration === undefined || configuration.providerId === "development") {
              return yield* new PaymentProviderProductValidationError({
                message: `Payment provider configuration ${mapping.paymentProviderConfigurationId} not found`,
              });
            }
            yield* Effect.annotateCurrentSpan({
              "voidhash.payment_provider.id": configuration.providerId,
              "voidhash.project.id": product.projectId,
            });
            yield* validateSameProject(configuration.projectId, product.projectId);
            yield* permission.requireProjectAll(
              product.projectId,
              `User ${session.user?.id} is not authorized to update payment provider products for project ${product.projectId}`,
            );
            const provider = yield* findProvider(configuration.providerId);
            const validation = yield* provider.validateProductConfiguration(input.configuration);
            yield* validateActiveProviderKeyAvailable({
              excludeId: mapping.id,
              paymentProviderConfigurationId: mapping.paymentProviderConfigurationId,
              productId: mapping.productId,
              providerProductKey: validation.productKey,
            });
            yield* repository.updateProviderProduct({
              configuration: validation.parsedConfiguration,
              id: mapping.id,
              providerProductKey: validation.productKey,
            });
            yield* audit
              .append({
                action: "updated",
                entityId: mapping.id,
                entityType: "payment-provider-product",
                parentEntityId: mapping.productId,
                projectId: product.projectId,
              })
              .pipe(Effect.ignore);
            yield* cache.invalidate(product.projectId);
            if (mapping.isActive && mapping.providerProductKey !== validation.productKey) {
              yield* scheduleReplay({
                paymentProviderConfigurationId: configuration.id,
                paymentProviderProductId: mapping.id,
                providerId: configuration.providerId,
                providerProductKey: validation.productKey,
              });
            }
          }),
        ),
    });
  },
)();

/** Core provider-product orchestration over infrastructure-neutral management ports. */
export const PaymentProviderProductOperationsLive = Layer.effect(
  PaymentProviderProductOperations,
  makePaymentProviderProductOperations,
);
