import * as P from "effect/Predicate";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  PaymentProviderConfigurationOperations,
  ProjectPermissionCheck,
  PurchaseAuditLog,
  PurchaseManagementRepository,
  type PurchasePortError,
  SchemaCacheInvalidation,
} from "../../application/ports.ts";
import {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationInUseError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError,
} from "../../domain/ProviderConfiguration.ts";
import {
  AppStorePaymentProvider,
  GooglePlayPaymentProvider,
  StripePaymentProvider,
  type AnyPaymentProviderShape,
} from "./PurchaseProviderRegistry.ts";

const sessionProjectIds = (session: typeof AuthSession.Service): ReadonlyArray<string> =>
  session.projects.map((project) => project.id);

const annotateUser = (session: typeof AuthSession.Service) => {
  if (session.user?.id === undefined) return Effect.void;
  return Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
};

const portErrorMessage = (error: PurchasePortError | { readonly _tag: unknown }) => {
  if ("message" in error && P.isString(error.message)) return error.message;
  return "Purchase persistence operation failed";
};

const makePaymentProviderConfigurationOperations = Effect.fn(
  "makePaymentProviderConfigurationOperations",
)(function* () {
  const repository = yield* PurchaseManagementRepository;
  const audit = yield* PurchaseAuditLog;
  const permission = yield* ProjectPermissionCheck;
  const cache = yield* SchemaCacheInvalidation;
  const providers: ReadonlyArray<AnyPaymentProviderShape> = [
    yield* StripePaymentProvider,
    yield* AppStorePaymentProvider,
    yield* GooglePlayPaymentProvider,
  ];

  const findProvider = (providerId: string) => {
    const provider = providers.find((candidate) => candidate.id === providerId);
    if (provider !== undefined) return Effect.succeed(provider);
    return Effect.fail(
      new PaymentProviderConfigurationValidationError({
        cause: `Provider ${providerId} not found`,
      }),
    );
  };

  const mapPortError = <A, E, R>(effect: Effect.Effect<A, E | PurchasePortError, R>) =>
    effect.pipe(
      Effect.catchTag("PurchasePortError", (error) =>
        Effect.fail(
          new PaymentProviderConfigurationServiceError({
            cause: portErrorMessage(error),
          }),
        ),
      ),
    );

  const optionalName = (name: Option.Option<string>) =>
    Option.match(name, { onNone: () => ({}), onSome: (value) => ({ name: value }) });

  return PaymentProviderConfigurationOperations.of({
    createPaymentProviderConfiguration: (input) =>
      mapPortError(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan({
            "voidhash.payment_provider.id": input.providerId,
            "voidhash.project.id": input.projectId,
          });
          yield* annotateUser(session);
          yield* permission.requireProjectAll(
            input.projectId,
            `User ${session.user?.id} is not authorized to create payment provider configurations for project ${input.projectId}`,
          );
          const provider = yield* findProvider(input.providerId);
          const existing = yield* repository.findConfigurationByProjectProvider(input);
          if (existing !== undefined) {
            return yield* new PaymentProviderAlreadyExistsError({
              message: `Provider ${input.providerId} can only have one configuration`,
            });
          }
          const configuration = yield* provider.defaultGlobalConfiguration();
          const created = yield* repository.insertConfiguration({
            configuration,
            enabled: false,
            name: provider.title,
            paymentProviderKey: "empty",
            projectId: input.projectId,
            providerId: input.providerId,
          });
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            created.id,
          );
          yield* audit
            .append({
              action: "created",
              changes: { snapshot: { providerId: input.providerId } },
              entityId: created.id,
              entityType: "payment-provider-configuration",
              projectId: input.projectId,
            })
            .pipe(Effect.ignore);
          yield* Effect.log(
            `Created payment provider configuration ${created.id} for project ${input.projectId}`,
          );
          yield* cache.invalidate(input.projectId);
          return created;
        }),
      ),
    deletePaymentProviderConfiguration: (input) =>
      mapPortError(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          yield* annotateUser(session);
          const existing = yield* repository.findScopedConfiguration({
            id: input.paymentProviderConfigurationId,
            projectIds: sessionProjectIds(session),
          });
          if (existing === undefined) {
            return yield* new PaymentProviderConfigurationNotFoundError({
              message: `Payment provider configuration with id ${input.paymentProviderConfigurationId} not found`,
            });
          }
          yield* Effect.annotateCurrentSpan({
            "voidhash.payment_provider.id": existing.providerId,
            "voidhash.project.id": existing.projectId,
          });
          yield* permission.requireProjectAll(
            existing.projectId,
            `User ${session.user?.id} is not authorized to delete payment provider configuration ${input.paymentProviderConfigurationId}`,
          );
          if (yield* repository.configurationHasMappings(input.paymentProviderConfigurationId)) {
            return yield* new PaymentProviderConfigurationInUseError({
              message:
                "Payment provider configurations with product mappings cannot be deleted; delete the product mappings first",
            });
          }
          yield* repository.softDeleteConfiguration(input.paymentProviderConfigurationId);
          yield* audit
            .append({
              action: "deleted",
              entityId: input.paymentProviderConfigurationId,
              entityType: "payment-provider-configuration",
              projectId: existing.projectId,
            })
            .pipe(Effect.ignore);
          yield* Effect.log(
            `Deleted payment provider configuration ${input.paymentProviderConfigurationId}`,
          );
          yield* cache.invalidate(existing.projectId);
        }),
      ),
    getPaymentProviderConfigurationById: (id) =>
      mapPortError(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.configuration_id", id);
          yield* annotateUser(session);
          const configuration = yield* repository.findScopedConfiguration({
            id,
            projectIds: sessionProjectIds(session),
          });
          if (configuration === undefined) {
            return yield* new PaymentProviderConfigurationNotFoundError({
              message: "Payment provider configuration not found",
            });
          }
          yield* Effect.annotateCurrentSpan({
            "voidhash.payment_provider.id": configuration.providerId,
            "voidhash.project.id": configuration.projectId,
          });
          yield* permission.requireProjectAll(
            configuration.projectId,
            `User ${session.user?.id} is not authorized to access payment provider configuration ${id}`,
          );
          return configuration;
        }),
      ),
    getPaymentProviderConfigurations: (projectId) =>
      mapPortError(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
          yield* annotateUser(session);
          yield* permission.requireProjectAll(
            projectId,
            `User ${session.user?.id} is not authorized to access payment provider configurations for project ${projectId}`,
          );
          return yield* repository.listConfigurations(projectId);
        }),
      ),
    updatePaymentProviderConfiguration: (input) =>
      mapPortError(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.configuration_id", input.id);
          yield* annotateUser(session);
          const existing = yield* repository.findScopedConfiguration({
            id: input.id,
            projectIds: sessionProjectIds(session),
          });
          if (existing === undefined) {
            return yield* new PaymentProviderConfigurationNotFoundError({
              message: "Payment provider configuration not found",
            });
          }
          yield* Effect.annotateCurrentSpan({
            "voidhash.payment_provider.id": existing.providerId,
            "voidhash.project.id": existing.projectId,
          });
          yield* permission.requireProjectAll(
            existing.projectId,
            `User ${session.user?.id} is not authorized to update payment provider configuration ${input.id}`,
          );
          const provider = yield* findProvider(existing.providerId);
          if (!input.enabled) {
            const validation = yield* provider
              .validateGlobalConfiguration(input.configuration)
              .pipe(Effect.option);
            if (Option.isNone(validation)) {
              yield* Effect.logWarning(
                `Payment provider configuration ${input.id} saved while disabled without passing validation; any secrets it contains are stored unencrypted until it validates.`,
              );
            }
            yield* repository.updateConfiguration({
              configuration: Option.match(validation, {
                onNone: () => input.configuration,
                onSome: (value) => value.parsedConfiguration,
              }),
              enabled: false,
              id: input.id,
              ...optionalName(Option.fromNullishOr(input.name)),
            });
            yield* Effect.log(
              `Updated payment provider configuration ${input.id} while disabled (validated: ${Option.isSome(validation)}).`,
            );
          } else {
            const validation = yield* provider.validateGlobalConfiguration(input.configuration);
            const conflict = yield* repository.findConfigurationKeyConflict({
              excludeId: input.id,
              paymentProviderKey: validation.paymentProviderKey,
              projectId: existing.projectId,
              providerId: existing.providerId,
            });
            if (conflict !== undefined) {
              return yield* new PaymentProviderConfigurationKeyUnavailableError({
                message: "Payment provider with similar configuration already exists.",
              });
            }
            yield* repository.updateConfiguration({
              configuration: validation.parsedConfiguration,
              enabled: true,
              id: input.id,
              ...optionalName(Option.fromNullishOr(input.name)),
              paymentProviderKey: validation.paymentProviderKey,
            });
            yield* Effect.log(
              `Updated payment provider configuration ${input.id}; validated and enabled.`,
            );
          }
          yield* audit
            .append({
              action: "updated",
              changes: { enabled: input.enabled },
              entityId: input.id,
              entityType: "payment-provider-configuration",
              projectId: existing.projectId,
            })
            .pipe(Effect.ignore);
          yield* cache.invalidate(existing.projectId);
          return { id: input.id };
        }),
      ),
  });
})();

/** Core provider-configuration orchestration over infrastructure-neutral management ports. */
export const PaymentProviderConfigurationOperationsLive = Layer.effect(
  PaymentProviderConfigurationOperations,
  makePaymentProviderConfigurationOperations,
);
