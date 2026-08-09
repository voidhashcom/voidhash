import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";
import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  NotificationConfigKeyUnavailableError,
  NotificationConfigNotFoundError,
} from "../../domain/notifications/PushNotificationConfiguration.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  eq,
  pushNotificationConfigs,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";
import {
  ApplePushNotificationService,
  FirebaseCloudMessagingService,
  type AnyPushDeliveryProviderShape,
  type PushDeliveryProviderKind,
} from "./push-delivery-provider.ts";

/**
 * Catch-all service error. Wraps `EffectDrizzleQueryError` and other
 * infrastructural failures at the public-method boundary, AND the fail-closed
 * encryption-gate refusal (DEVIATION 2).
 */
export class NotificationsConfigurationServiceError extends Schema.TaggedErrorClass<NotificationsConfigurationServiceError>(
  "NotificationsConfigurationServiceError",
)("NotificationsConfigurationServiceError", { cause: Schema.String }) {}

const isPushProviderKind = (value: string): value is PushDeliveryProviderKind =>
  value === "fcm" || value === "apns";

/**
 * Dashboard CRUD for per-(project, provider) push credentials — a near-verbatim
 * structural clone of `PaymentProviderConfigurationService` (same
 * one-active-config-per-(project, provider) invariant, validate-on-enable flow,
 * soft delete, audit-log + schema-cache-bust on every write). Two deliberate
 * deviations, both about secret exposure:
 *
 *  - DEVIATION 1: the read DTO OMITS secret fields (write-only secrets); the
 *    provider's `toReadDto` returns only non-secret metadata + `has*` presence
 *    flags. Secrets are never round-tripped to the browser.
 *  - DEVIATION 2: a fail-closed encryption gate. In production
 *    (`requireEncryption`), enabling a config whose secret is still plaintext
 *    after the encrypt pass (i.e. `ENCRYPTION_KEY` unset, crypto no-op) is
 *    REFUSED — a prose-only go-live gate is unenforceable.
 */
const make = (config: { readonly requireEncryption: Effect.Effect<boolean> }) =>
  Effect.gen(function* () {
    const requireEncryption = yield* config.requireEncryption;
    const db = yield* Db;
    const auditLog = yield* AuditLogPort;
    const schemaCache = yield* SchemaCacheInvalidationService;
    const fcm = yield* FirebaseCloudMessagingService;
    const apns = yield* ApplePushNotificationService;

    const providers: Record<PushDeliveryProviderKind, AnyPushDeliveryProviderShape> = {
      fcm,
      apns,
    };

    const findProvider = (
      providerId: string,
    ): Effect.Effect<AnyPushDeliveryProviderShape, NotificationConfigNotFoundError> => {
      if (isPushProviderKind(providerId)) return Effect.succeed(providers[providerId]);
      return Effect.fail(
        new NotificationConfigNotFoundError({ message: `Unknown push provider ${providerId}` }),
      );
    };

    const readConfigurationDto = (
      providerId: string,
      configuration: typeof pushNotificationConfigs.$inferSelect.configuration,
    ) => {
      if (isPushProviderKind(providerId)) return providers[providerId].toReadDto(configuration);
      return {};
    };

    const namePatch = (name: string | undefined): { name?: string } => {
      if (name === undefined) return {};
      return { name };
    };

    /** Secret-OMITTING read DTO (DEVIATION 1). */
    const toReadDto = (row: typeof pushNotificationConfigs.$inferSelect) => {
      return {
        id: row.id,
        projectId: row.projectId,
        providerId: row.providerId,
        enabled: row.enabled,
        name: row.name,
        pushProviderKey: row.pushProviderKey,
        activeProviderId: row.activeProviderId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        configuration: readConfigurationDto(row.providerId, row.configuration),
      };
    };

    const getPushNotificationConfigurations = Effect.fn("getPushNotificationConfigurations")(
      function* (projectId: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access push notification configurations for project ${projectId}`,
        );
        const rows = yield* db.query.pushNotificationConfigs.findMany({
          where: { projectId, deletedAt: { isNull: true } },
        });
        return rows.map(toReadDto);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new NotificationsConfigurationServiceError({ cause: String(error.cause) }),
              ),
          }),
        ),
    );

    const getPushNotificationConfigurationById = Effect.fn("getPushNotificationConfigurationById")(
      function* (id: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.push.configuration_id", id);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const row = yield* db.query.pushNotificationConfigs.findFirst({ where: { id } });
        if (!row) {
          return yield* Effect.fail(
            new NotificationConfigNotFoundError({
              message: "Push notification configuration not found",
            }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", row.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.push.provider_id", row.providerId);
        yield* checkProjectPermission(
          row.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access push notification configuration ${id}`,
        );
        return toReadDto(row);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new NotificationsConfigurationServiceError({ cause: String(error.cause) }),
              ),
          }),
        ),
    );

    const createPushNotificationConfiguration = Effect.fn("createPushNotificationConfiguration")(
      function* (input: { readonly projectId: string; readonly providerId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.push.provider_id", input.providerId);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create push notification configurations for project ${input.projectId}`,
        );

        const provider = yield* findProvider(input.providerId);

        const existing = yield* db.query.pushNotificationConfigs.findFirst({
          where: {
            projectId: input.projectId,
            providerId: input.providerId,
            deletedAt: { isNull: true },
          },
        });
        if (existing) {
          return yield* Effect.fail(
            new NotificationConfigKeyUnavailableError({
              message: `Provider ${input.providerId} can only have one configuration`,
            }),
          );
        }

        const id = generateId("pushNotificationConfig");
        yield* Effect.annotateCurrentSpan("voidhash.push.configuration_id", id);
        const defaultConfiguration = yield* provider.defaultGlobalConfiguration();
        yield* db.insert(pushNotificationConfigs).values({
          id,
          projectId: input.projectId,
          providerId: input.providerId,
          pushProviderKey: "empty",
          enabled: false,
          name: provider.title,
          configuration: defaultConfiguration,
        });

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.PushNotificationConfiguration,
            entityId: id,
            action: AuditLogAction.Created,
            changes: { snapshot: { providerId: input.providerId } },
          })
          .pipe(Effect.ignore);
        yield* schemaCache.invalidate(input.projectId);
        return { id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new NotificationsConfigurationServiceError({ cause: String(error.cause) }),
              ),
          }),
        ),
    );

    const updatePushNotificationConfiguration = Effect.fn("updatePushNotificationConfiguration")(
      function* (input: {
        readonly id: string;
        readonly enabled: boolean;
        readonly name?: string;
        readonly configuration: Record<string, unknown>;
      }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.push.configuration_id", input.id);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }

        const existing = yield* db.query.pushNotificationConfigs.findFirst({
          where: { id: input.id },
        });
        if (!existing) {
          return yield* Effect.fail(
            new NotificationConfigNotFoundError({
              message: "Push notification configuration not found",
            }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.push.provider_id", existing.providerId);
        yield* checkProjectPermission(
          existing.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to update push notification configuration ${input.id}`,
        );

        // Secrets are OMITTED from the read DTO (DEVIATION 1), so the dashboard
        // cannot round-trip them: a partial update that leaves a secret field
        // blank must PRESERVE the stored (encrypted) value, not blank it. Merge
        // the incoming configuration over the stored one — a freshly provided
        // secret still overrides; an omitted one falls back to the persisted
        // value (which `validateGlobalConfiguration` accepts, as encrypt is
        // idempotent on already-`v1.aesgcm:`-prefixed secrets). Without this,
        // enabling an already-configured provider fails schema validation.
        const mergedConfiguration = { ...existing.configuration, ...input.configuration };

        // enabled=false drafts persist without validation (incomplete configs save).
        if (!input.enabled) {
          yield* db
            .update(pushNotificationConfigs)
            .set({
              configuration: mergedConfiguration,
              enabled: false,
              ...namePatch(input.name),
              updatedAt: yield* DateTime.nowAsDate,
            })
            .where(eq(pushNotificationConfigs.id, input.id));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.PushNotificationConfiguration,
              entityId: input.id,
              action: AuditLogAction.Updated,
              changes: { enabled: false },
            })
            .pipe(Effect.ignore);
          yield* schemaCache.invalidate(existing.projectId);
          return { id: input.id };
        }

        const provider = yield* findProvider(existing.providerId);
        // validateGlobalConfiguration decodes the schema and encrypts secrets
        // (idempotent). On enable only.
        const validation = yield* provider.validateGlobalConfiguration(mergedConfiguration);

        // DEVIATION 2: fail-closed. In production we refuse to enable a config
        // whose secret is still plaintext after the encrypt pass (no key set).
        if (requireEncryption && provider.hasPlaintextSecret(validation.parsedConfiguration)) {
          return yield* Effect.fail(
            new NotificationsConfigurationServiceError({
              cause: "refusing to persist a push secret while ENCRYPTION_KEY is unset",
            }),
          );
        }

        // Collision check among ACTIVE rows only (soft-deleted have null activeProviderId).
        const conflicting = yield* db.query.pushNotificationConfigs.findFirst({
          where: {
            projectId: existing.projectId,
            providerId: existing.providerId,
            pushProviderKey: validation.pushProviderKey,
            id: { ne: input.id },
            deletedAt: { isNull: true },
          },
        });
        if (conflicting) {
          return yield* Effect.fail(
            new NotificationConfigKeyUnavailableError({
              message: "A push provider with a similar configuration already exists.",
            }),
          );
        }

        yield* db
          .update(pushNotificationConfigs)
          .set({
            configuration: validation.parsedConfiguration,
            enabled: input.enabled,
            ...namePatch(input.name),
            pushProviderKey: validation.pushProviderKey,
            updatedAt: yield* DateTime.nowAsDate,
          })
          .where(eq(pushNotificationConfigs.id, input.id));

        yield* auditLog
          .append({
            projectId: existing.projectId,
            entityType: AuditLogEntityType.PushNotificationConfiguration,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { enabled: input.enabled },
          })
          .pipe(Effect.ignore);
        yield* schemaCache.invalidate(existing.projectId);
        return { id: input.id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new NotificationsConfigurationServiceError({ cause: String(error.cause) }),
              ),
          }),
        ),
    );

    const deletePushNotificationConfiguration = Effect.fn("deletePushNotificationConfiguration")(
      function* (input: { readonly pushNotificationConfigurationId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan(
          "voidhash.push.configuration_id",
          input.pushNotificationConfigurationId,
        );
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const existing = yield* db.query.pushNotificationConfigs.findFirst({
          where: { id: input.pushNotificationConfigurationId },
        });
        if (!existing) {
          return yield* Effect.fail(
            new NotificationConfigNotFoundError({
              message: `Push notification configuration ${input.pushNotificationConfigurationId} not found`,
            }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
        yield* checkProjectPermission(
          existing.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete push notification configuration ${input.pushNotificationConfigurationId}`,
        );

        const deletedAt = yield* DateTime.nowAsDate;
        yield* db
          .update(pushNotificationConfigs)
          .set({ deletedAt, updatedAt: deletedAt })
          .where(eq(pushNotificationConfigs.id, input.pushNotificationConfigurationId));

        yield* auditLog
          .append({
            projectId: existing.projectId,
            entityType: AuditLogEntityType.PushNotificationConfiguration,
            entityId: input.pushNotificationConfigurationId,
            action: AuditLogAction.Deleted,
          })
          .pipe(Effect.ignore);
        yield* schemaCache.invalidate(existing.projectId);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new NotificationsConfigurationServiceError({ cause: String(error.cause) }),
              ),
          }),
        ),
    );

    return constant({
      createPushNotificationConfiguration,
      deletePushNotificationConfiguration,
      getPushNotificationConfigurationById,
      getPushNotificationConfigurations,
      updatePushNotificationConfiguration,
    });
  });

/**
 * `AuditLogPort`, `AuthSession`, `Db`, `SchemaCacheInvalidationService`, and
 * the two delivery-provider tags are provided by the application root.
 */
export class NotificationsConfigurationService extends Context.Service<NotificationsConfigurationService>()(
  "NotificationsConfigurationService",
  // Default: encryption gate OFF (local/dev). The app root overrides this with
  // `NotificationsConfigurationService.layer({ requireEncryption })` reading
  // `PUSH_REQUIRE_ENCRYPTION` so prod fails closed.
  { make: make({ requireEncryption: Effect.succeed(false) }) },
) {
  static layer = (config: { readonly requireEncryption: Effect.Effect<boolean> }) =>
    Layer.effect(NotificationsConfigurationService)(make(config));
}
