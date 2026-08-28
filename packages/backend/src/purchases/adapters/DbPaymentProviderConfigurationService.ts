import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";

import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationInUseError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationValidationError,
} from "@voidhash/core-v2";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  eq,
  paymentProviderConfigurations,
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

/** Ids of the projects the caller's session can see; every id lookup is scoped to them. */
const sessionProjectIds = (
  session: { readonly projects: ReadonlyArray<{ readonly id: string }> } | undefined,
): ReadonlyArray<string> => (session?.projects ?? []).map((project) => project.id);

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
  "@voidhash/backend/purchases/PaymentProviderConfigurationService",
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

      /**
       * Tenant-scoped, soft-delete-aware lookup by id.
       *
       * Restricting the predicate to the caller's own projects makes a
       * configuration owned by another tenant read as not-found instead of
       * resolving and then naming its owner in the permission failure — the same
       * fail-closed convention the webhook endpoint lookups use. Excluding
       * `deletedAt` rows here keeps a soft-deleted configuration unaddressable
       * by id, matching the list path.
       */
      const findScopedConfiguration = Effect.fnUntraced(function* (
        id: string,
        projectIds: ReadonlyArray<string>,
      ) {
        if (projectIds.length === 0) {
          return undefined;
        }
        return yield* db.query.paymentProviderConfigurations.findFirst({
          where: {
            id,
            projectId: { in: [...projectIds] },
            providerId: { ne: "development" },
            deletedAt: { isNull: true },
          },
        });
      });

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
          const configuration = yield* findScopedConfiguration(id, sessionProjectIds(session));
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
            `User ${session?.user?.id} is not authorized to access payment provider configuration ${id}`,
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

          const existing = yield* findScopedConfiguration(input.id, sessionProjectIds(session));
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

          const provider = yield* findProvider(existing.providerId);

          if (!input.enabled) {
            // Even while disabled, run the provider validation best-effort so
            // secrets in a complete configuration are encrypted at rest
            // instead of waiting for an enable pass. An incomplete draft that
            // fails validation is still persisted verbatim — drafts are
            // allowed — but that plaintext window is now the exception, and
            // it is logged.
            const draftValidation = yield* provider
              .validateGlobalConfiguration(input.configuration)
              .pipe(Effect.option);
            if (Option.isNone(draftValidation)) {
              yield* Effect.logWarning(
                `Payment provider configuration ${input.id} saved while disabled without passing validation; any secrets it contains are stored unencrypted until it validates.`,
              );
            }
            const configurationToStore = Option.match(draftValidation, {
              onNone: () => input.configuration,
              onSome: (validation) => validation.parsedConfiguration,
            });
            yield* db
              .update(paymentProviderConfigurations)
              .set({
                configuration: configurationToStore,
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
              `Updated payment provider configuration ${input.id} while disabled (validated: ${Option.isSome(draftValidation)}).`,
            );
            yield* schemaCache.invalidate(existing.projectId);
            return { id: input.id };
          }

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
          const existing = yield* findScopedConfiguration(
            input.paymentProviderConfigurationId,
            sessionProjectIds(session),
          );
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

          // Dependent-mapping guard (the mapping delete has the analogous
          // purchase-history guard): a configuration with product mappings
          // still attached cannot be deleted, or webhook processing and
          // catalog reads would dangle on a soft-deleted parent.
          const dependentMapping = yield* db.query.paymentProviderConfigurationProducts.findFirst({
            columns: { id: true },
            where: { paymentProviderConfigurationId: input.paymentProviderConfigurationId },
          });
          if (dependentMapping) {
            return yield* Effect.fail(
              new PaymentProviderConfigurationInUseError({
                message:
                  "Payment provider configurations with product mappings cannot be deleted; delete the product mappings first",
              }),
            );
          }

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
