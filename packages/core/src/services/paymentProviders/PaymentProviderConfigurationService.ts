import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationValidationError,
} from "../../domain/paymentProvider/PaymentProviderConfiguration.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  eq,
  paymentProviderConfigurations,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";
import {
  AppStorePaymentProvider,
  type AnyPaymentProviderShape,
  GooglePlayPaymentProvider,
  StripePaymentProvider,
} from "./PaymentProvider.ts";

/**
 * Catch-all service error. Wraps `DbError` and other infrastructural
 * failures at the public-method boundary.
 */
export class PaymentProviderConfigurationServiceError extends Schema.TaggedErrorClass<PaymentProviderConfigurationServiceError>(
  "PaymentProviderConfigurationServiceError",
)("PaymentProviderConfigurationServiceError", { cause: Schema.String }) {}

/** Spreads a `name` column update only when the caller supplied a new name. */
const nameUpdate = (name: string | undefined): { readonly name?: string } => {
  if (name === undefined) {
    return {};
  }
  return { name };
};

/**
 * `PaymentProviderConfigurationService` orchestrates the
 * payment-provider-configuration aggregate (one configuration per
 * `(project, provider)` pair).
 *
 * `AuditLogPort`, `AuthSession`, `Db`, `SchemaCacheInvalidationService`,
 * and the three `PaymentProvider` adapter stubs are provided by the
 * application root.
 */
export class PaymentProviderConfigurationService extends Context.Service<PaymentProviderConfigurationService>()(
  "PaymentProviderConfigurationService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const auditLog = yield* AuditLogPort;
      const schemaCache = yield* SchemaCacheInvalidationService;
      const stripePaymentProvider = yield* StripePaymentProvider;
      const appStorePaymentProvider = yield* AppStorePaymentProvider;
      const googlePlayPaymentProvider = yield* GooglePlayPaymentProvider;

      const paymentProviders: ReadonlyArray<AnyPaymentProviderShape> = [
        stripePaymentProvider,
        appStorePaymentProvider,
        googlePlayPaymentProvider,
      ];

      const findProvider = (
        providerId: string,
      ): Effect.Effect<AnyPaymentProviderShape, PaymentProviderConfigurationValidationError> => {
        const provider = paymentProviders.find((candidate) => candidate.id === providerId);
        if (!provider) {
          return Effect.fail(
            new PaymentProviderConfigurationValidationError({
              cause: `Provider ${providerId} not found`,
            }),
          );
        }
        return Effect.succeed(provider);
      };

      const getPaymentProviderConfigurations = Effect.fn("getPaymentProviderConfigurations")(
        function* (projectId: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          yield* checkProjectPermission(
            projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access payment provider configurations for project ${projectId}`,
          );
          return yield* db.query.paymentProviderConfigurations.findMany({
            where: {
              projectId,
              deletedAt: { isNull: true },
              providerId: { ne: "development" },
            },
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PaymentProviderConfigurationServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      const getPaymentProviderConfigurationById = Effect.fn("getPaymentProviderConfigurationById")(
        function* (id: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.configuration_id", id);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const configuration = yield* db.query.paymentProviderConfigurations.findFirst({
            where: { id, providerId: { ne: "development" } },
          });
          if (!configuration) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationNotFoundError({
                message: "Payment provider configuration not found",
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", configuration.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            configuration.providerId,
          );
          yield* checkProjectPermission(
            configuration.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access payment provider configuration ${id} for project ${configuration.projectId}`,
          );
          return configuration;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PaymentProviderConfigurationServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      const createPaymentProviderConfiguration = Effect.fn("createPaymentProviderConfiguration")(
        function* (input: { readonly projectId: string; readonly providerId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", input.providerId);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create payment provider configurations for project ${input.projectId}`,
          );

          const provider = yield* findProvider(input.providerId);

          const existing = yield* db.query.paymentProviderConfigurations.findFirst({
            where: {
              projectId: input.projectId,
              providerId: input.providerId,
              deletedAt: { isNull: true },
            },
          });
          if (existing) {
            return yield* Effect.fail(
              new PaymentProviderAlreadyExistsError({
                message: `Provider ${input.providerId} can only have one configuration`,
              }),
            );
          }

          const id = generateId("paymentProviderConfiguration");
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.configuration_id", id);
          const defaultGlobalConfiguration = yield* provider.defaultGlobalConfiguration();
          yield* db.insert(paymentProviderConfigurations).values({
            configuration: defaultGlobalConfiguration,
            enabled: false,
            id,
            name: provider.title,
            paymentProviderKey: "empty",
            projectId: input.projectId,
            providerId: input.providerId,
          });

          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.PaymentProviderConfiguration,
              entityId: id,
              action: AuditLogAction.Created,
              changes: { snapshot: { providerId: input.providerId } },
            })
            .pipe(Effect.ignore);

          yield* Effect.log(
            `Created payment provider configuration ${id} for project ${input.projectId}`,
          );
          yield* schemaCache.invalidate(input.projectId);
          return { id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PaymentProviderConfigurationServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      const updatePaymentProviderConfiguration = Effect.fn("updatePaymentProviderConfiguration")(
        function* (input: {
          readonly id: string;
          readonly enabled: boolean;
          readonly name?: string;
          readonly configuration: Record<string, unknown>;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.configuration_id", input.id);
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }

          const existing = yield* db.query.paymentProviderConfigurations.findFirst({
            where: { id: input.id, providerId: { ne: "development" } },
          });
          if (!existing) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationNotFoundError({
                message: "Payment provider configuration not found",
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", existing.providerId);
          yield* checkProjectPermission(
            existing.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update payment provider configuration ${input.id}`,
          );

          if (!input.enabled) {
            yield* db
              .update(paymentProviderConfigurations)
              .set({
                configuration: input.configuration,
                enabled: false,
                ...nameUpdate(input.name),
                updatedAt: yield* DateTime.nowAsDate,
              })
              .where(eq(paymentProviderConfigurations.id, input.id));

            yield* auditLog
              .append({
                projectId: existing.projectId,
                entityType: AuditLogEntityType.PaymentProviderConfiguration,
                entityId: input.id,
                action: AuditLogAction.Updated,
                changes: { enabled: false },
              })
              .pipe(Effect.ignore);
            yield* Effect.log(
              `Updated payment provider configuration ${input.id}; not validated because the provider is disabled.`,
            );
            yield* schemaCache.invalidate(existing.projectId);
            return { id: input.id };
          }

          const provider = yield* findProvider(existing.providerId);
          const validation = yield* provider.validateGlobalConfiguration(input.configuration);

          const conflicting = yield* db.query.paymentProviderConfigurations.findFirst({
            where: {
              projectId: existing.projectId,
              providerId: existing.providerId,
              paymentProviderKey: validation.paymentProviderKey,
              id: { ne: input.id },
              deletedAt: { isNull: true },
            },
          });
          if (conflicting) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationKeyUnavailableError({
                message: "Payment provider with similar configuration already exists.",
              }),
            );
          }

          yield* db
            .update(paymentProviderConfigurations)
            .set({
              configuration: validation.parsedConfiguration,
              enabled: input.enabled,
              ...nameUpdate(input.name),
              paymentProviderKey: validation.paymentProviderKey,
              updatedAt: yield* DateTime.nowAsDate,
            })
            .where(eq(paymentProviderConfigurations.id, input.id));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.PaymentProviderConfiguration,
              entityId: input.id,
              action: AuditLogAction.Updated,
              changes: { enabled: input.enabled },
            })
            .pipe(Effect.ignore);
          yield* Effect.log(
            `Updated payment provider configuration ${input.id}; validated and enabled.`,
          );
          yield* schemaCache.invalidate(existing.projectId);
          return { id: input.id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PaymentProviderConfigurationServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      const deletePaymentProviderConfiguration = Effect.fn("deletePaymentProviderConfiguration")(
        function* (input: { readonly paymentProviderConfigurationId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          if (session?.user?.id) {
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          }
          const existing = yield* db.query.paymentProviderConfigurations.findFirst({
            where: {
              id: input.paymentProviderConfigurationId,
              providerId: { ne: "development" },
            },
          });
          if (!existing) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationNotFoundError({
                message: `Payment provider configuration with id ${input.paymentProviderConfigurationId} not found`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", existing.providerId);
          yield* checkProjectPermission(
            existing.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to delete payment provider configuration ${input.paymentProviderConfigurationId}`,
          );

          const deletedAt = yield* DateTime.nowAsDate;
          yield* db
            .update(paymentProviderConfigurations)
            .set({ deletedAt, updatedAt: deletedAt })
            .where(eq(paymentProviderConfigurations.id, input.paymentProviderConfigurationId));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.PaymentProviderConfiguration,
              entityId: input.paymentProviderConfigurationId,
              action: AuditLogAction.Deleted,
            })
            .pipe(Effect.ignore);
          yield* Effect.log(
            `Deleted payment provider configuration ${input.paymentProviderConfigurationId}`,
          );
          yield* schemaCache.invalidate(existing.projectId);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PaymentProviderConfigurationServiceError({ cause: String(error.cause) }),
                ),
            }),
          ),
      );

      return constant({
        createPaymentProviderConfiguration,
        deletePaymentProviderConfiguration,
        getPaymentProviderConfigurationById,
        getPaymentProviderConfigurations,
        updatePaymentProviderConfiguration,
      });
    }),
  },
) {
  static layer = Layer.effect(PaymentProviderConfigurationService)(
    PaymentProviderConfigurationService.make,
  );
}
