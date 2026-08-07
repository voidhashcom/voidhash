import { Clock, Context, DateTime, Effect, Layer, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";

import { ApiKeyNotFoundError } from "../../domain/apiKey/ApiKey.ts";
import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  type ApiKey as DbApiKey,
  type Apikey as DbUserApiKey,
  type Project as DbProject,
  type User as DbUser,
  AuditLogAction,
  AuditLogEntityType,
  Db,
  apiKeys,
  apikey,
  eq,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import {
  createSecretKey as generateSecretKeyFn,
  createUserApiKey as generateUserApiKeyFn,
  hashKey,
} from "./api-keys.ts";

export type ApiKeyWithProject = DbApiKey & { readonly project: DbProject };
export type UserApiKeyWithUser = DbUserApiKey & { readonly user: DbUser };

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
export class ApiKeyServiceError extends Schema.TaggedErrorClass<ApiKeyServiceError>(
  "ApiKeyServiceError",
)("ApiKeyServiceError", { cause: Schema.String }) {}

const isExpired = (expiresAt: Date | null | undefined, nowMillis: number): boolean =>
  expiresAt !== null && expiresAt !== undefined && expiresAt.getTime() <= nowMillis;

/**
 * `ApiKeyService` is the single entry point for the three kinds of api keys:
 *
 * - **Secret keys** — project-scoped, hashed in storage, used by server-side
 *   integrations.
 * - **Publishable keys** — project-scoped, plain-text, embedded in clients.
 * - **User api keys** — user-scoped, hashed in storage. CLI device-auth flow
 *   is the first consumer.
 *
 * Mutating methods require `AuthSession` and emit audit-log entries. The
 * `validate*` methods are auth-establishing — they run in request middleware
 * before any session exists, so they don't depend on `AuthSession` and never
 * emit audit logs.
 *
 * `AuditLogPort`, `AuthSession`, and `Db` are provided by the application
 * root.
 */
export class ApiKeyService extends Context.Service<ApiKeyService>()("ApiKeyService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const db = yield* Db;

    const getApiKeys = Effect.fn("getApiKeys")(
      function* (projectId: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access api keys for project ${projectId}`,
        );
        return yield* db.query.apiKeys.findMany({
          orderBy: { isPublic: "desc", createdAt: "asc" },
          where: { projectId },
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    const getApiKeyById = Effect.fn("getApiKeyById")(
      function* (id: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", id);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        const apiKey = yield* db.query.apiKeys.findFirst({ where: { id } });
        if (!apiKey) {
          return yield* Effect.fail(new ApiKeyNotFoundError({ apiKeyId: id }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", apiKey.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", apiKey.isPublic);
        if (apiKey.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", apiKey.prefix);
        if (apiKey.end) yield* Effect.annotateCurrentSpan("voidhash.api_key.end", apiKey.end);
        yield* checkProjectPermission(
          apiKey.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access api key ${id} for project ${apiKey.projectId}`,
        );
        return apiKey;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    const createSecretKey = Effect.fn("createSecretKey")(
      function* (input: { readonly projectId: string; readonly name: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create secret keys for project ${input.projectId}`,
        );

        const { rawKey, ...secretKey } = yield* generateSecretKeyFn();
        const apiKeyId = generateId("apiSecretKey");
        yield* db.insert(apiKeys).values({
          id: apiKeyId,
          projectId: input.projectId,
          name: input.name,
          ...secretKey,
        });

        const apiKey = yield* db.query.apiKeys.findFirst({ where: { id: apiKeyId } });
        if (!apiKey) {
          return yield* Effect.fail(
            new ApiKeyServiceError({ cause: "API key not found after creation." }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", apiKey.id);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", apiKey.isPublic);
        if (apiKey.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", apiKey.prefix);
        if (apiKey.end) yield* Effect.annotateCurrentSpan("voidhash.api_key.end", apiKey.end);

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.ApiKey,
            entityId: apiKeyId,
            action: AuditLogAction.Created,
            changes: { name: input.name },
          })
          .pipe(Effect.ignore);

        return { ...apiKey, rawKey };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    const rotateSecretKey = Effect.fn("rotateSecretKey")(
      function* (input: { readonly secretKeyId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", input.secretKeyId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        const existingKey = yield* db.query.apiKeys.findFirst({
          where: { id: input.secretKeyId },
        });
        if (!existingKey) {
          return yield* Effect.fail(new ApiKeyNotFoundError({ apiKeyId: input.secretKeyId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existingKey.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", existingKey.isPublic);
        if (existingKey.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", existingKey.prefix);
        if (existingKey.end)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.end", existingKey.end);
        yield* checkProjectPermission(
          existingKey.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to rotate secret key ${input.secretKeyId} for project ${existingKey.projectId}`,
        );

        const { rawKey, ...newKey } = yield* generateSecretKeyFn();
        const now = yield* DateTime.nowAsDate;
        yield* db
          .update(apiKeys)
          .set({ ...newKey, updatedAt: now, createdAt: now })
          .where(eq(apiKeys.id, input.secretKeyId));

        yield* auditLog
          .append({
            projectId: existingKey.projectId,
            entityType: AuditLogEntityType.ApiKey,
            entityId: input.secretKeyId,
            action: AuditLogAction.Updated,
          })
          .pipe(Effect.ignore);

        return { ...existingKey, ...newKey, rawKey };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    const deleteSecretKey = Effect.fn("deleteSecretKey")(
      function* (input: { readonly secretKeyId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", input.secretKeyId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        const existingKey = yield* db.query.apiKeys.findFirst({
          where: { id: input.secretKeyId },
        });
        if (!existingKey) {
          return yield* Effect.fail(new ApiKeyNotFoundError({ apiKeyId: input.secretKeyId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existingKey.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", existingKey.isPublic);
        if (existingKey.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", existingKey.prefix);
        if (existingKey.end)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.end", existingKey.end);
        yield* checkProjectPermission(
          existingKey.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete secret key ${input.secretKeyId} for project ${existingKey.projectId}`,
        );

        yield* db.delete(apiKeys).where(eq(apiKeys.id, input.secretKeyId));

        yield* auditLog
          .append({
            projectId: existingKey.projectId,
            entityType: AuditLogEntityType.ApiKey,
            entityId: input.secretKeyId,
            action: AuditLogAction.Deleted,
          })
          .pipe(Effect.ignore);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /**
     * Mints a user-scoped api key for the authenticated user. The caller
     * supplies a display `name` and the `prefix` that namespaces the key by
     * intended use (e.g. `vh_cli_` for keys minted by the CLI device-auth
     * flow). Returns the raw key once — the database stores only its
     * SHA-256 hash.
     */
    const createUserApiKey = Effect.fn("createUserApiKey")(
      function* (input: { readonly name: string; readonly prefix: string }) {
        const session = yield* AuthSession;
        if (!session?.user?.id) {
          return yield* Effect.fail(
            new ApiKeyServiceError({ cause: "User api key creation requires a user session." }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (input.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", input.prefix);

        const { rawKey, ...userApiKey } = yield* generateUserApiKeyFn(input.prefix);
        const apiKeyId = crypto.randomUUID();
        const now = yield* DateTime.nowAsDate;
        yield* db.insert(apikey).values({
          createdAt: now,
          end: userApiKey.end,
          id: apiKeyId,
          key: userApiKey.key,
          name: input.name,
          prefix: userApiKey.prefix,
          updatedAt: now,
          userId: session.user.id,
        });
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", apiKeyId);
        if (userApiKey.end)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.end", userApiKey.end);

        return {
          createdAt: now,
          end: userApiKey.end,
          id: apiKeyId,
          name: input.name,
          prefix: userApiKey.prefix,
          rawKey,
        };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /** Lists user-scoped api keys for the authenticated user. */
    const listUserApiKeys = Effect.fn("listUserApiKeys")(
      function* () {
        const session = yield* AuthSession;
        if (!session?.user?.id) {
          return yield* Effect.fail(
            new ApiKeyServiceError({ cause: "Listing user api keys requires a user session." }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        return yield* db.query.apikey.findMany({
          orderBy: { createdAt: "asc" },
          where: { userId: session.user.id },
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /** Revokes a user-scoped api key owned by the authenticated user. */
    const revokeUserApiKey = Effect.fn("revokeUserApiKey")(
      function* (input: { readonly userApiKeyId: string }) {
        const session = yield* AuthSession;
        if (!session?.user?.id) {
          return yield* Effect.fail(
            new ApiKeyServiceError({ cause: "Revoking user api keys requires a user session." }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", input.userApiKeyId);

        const existing = yield* db.query.apikey.findFirst({
          where: { id: input.userApiKeyId },
        });
        if (!existing || existing.userId !== session.user.id) {
          return yield* Effect.fail(new ApiKeyNotFoundError({ apiKeyId: input.userApiKeyId }));
        }

        yield* db.delete(apikey).where(eq(apikey.id, input.userApiKeyId));
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /**
     * Validates a user-scoped api key by raw value. Hashes the key, looks it
     * up, and rejects disabled or expired records. No auth session required —
     * this is used by request middleware to establish identity.
     */
    const validateUserApiKey = Effect.fn("validateUserApiKey")(
      function* (rawKey: string) {
        const hashed = yield* hashKey(rawKey);
        const found = yield* db.query.apikey.findFirst({
          where: { key: hashed },
          with: { user: true },
        });
        const nowMillis = yield* Clock.currentTimeMillis;
        const user = found?.user;

        if (!found || !user || found.enabled === false || isExpired(found.expiresAt, nowMillis)) {
          // Never echo the raw (secret-equivalent) key — omit the id entirely.
          return yield* Effect.fail(new ApiKeyNotFoundError({}));
        }
        const record: UserApiKeyWithUser = { ...found, user };

        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", record.id);
        yield* Effect.annotateCurrentSpan("voidhash.user.id", record.userId);
        if (record.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", record.prefix);
        if (record.end) yield* Effect.annotateCurrentSpan("voidhash.api_key.end", record.end);

        return record;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /**
     * Validates a project-scoped secret key by raw value. Hashes it and looks
     * it up where `isPublic = false`. No auth session required.
     */
    const validateSecretKey = Effect.fn("validateSecretKey")(
      function* (rawKey: string) {
        const hashed = yield* hashKey(rawKey);
        const found = yield* db.query.apiKeys.findFirst({
          where: { key: hashed, isPublic: false },
          with: { project: true },
        });

        // `project` is a non-null foreign key, so the relation always resolves;
        // the check is what lets the non-nullable `project` be returned.
        if (!found?.project) {
          // Never echo the raw (secret-equivalent) key — omit the id entirely.
          return yield* Effect.fail(new ApiKeyNotFoundError({}));
        }
        const record: ApiKeyWithProject = { ...found, project: found.project };

        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", record.id);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", record.isPublic);
        yield* Effect.annotateCurrentSpan("voidhash.project.id", record.projectId);
        if (record.project?.organizationId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            record.project.organizationId,
          );
        if (record.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", record.prefix);
        if (record.end) yield* Effect.annotateCurrentSpan("voidhash.api_key.end", record.end);

        return record;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    /**
     * Validates a project-scoped publishable key by raw value. Publishable
     * keys are not hashed — they are embedded in client SDKs — so this is a
     * direct lookup where `isPublic = true`.
     */
    const validatePublishableKey = Effect.fn("validatePublishableKey")(
      function* (rawKey: string) {
        const found = yield* db.query.apiKeys.findFirst({
          where: { key: rawKey, isPublic: true },
          with: { project: true },
        });

        // `project` is a non-null foreign key, so the relation always resolves;
        // the check is what lets the non-nullable `project` be returned.
        if (!found?.project) {
          // Never echo the raw (secret-equivalent) key — omit the id entirely.
          return yield* Effect.fail(new ApiKeyNotFoundError({}));
        }
        const record: ApiKeyWithProject = { ...found, project: found.project };

        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", record.id);
        yield* Effect.annotateCurrentSpan("voidhash.api_key.is_public", record.isPublic);
        yield* Effect.annotateCurrentSpan("voidhash.project.id", record.projectId);
        if (record.project?.organizationId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            record.project.organizationId,
          );
        if (record.prefix)
          yield* Effect.annotateCurrentSpan("voidhash.api_key.prefix", record.prefix);
        if (record.end) yield* Effect.annotateCurrentSpan("voidhash.api_key.end", record.end);

        return record;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiKeyServiceError({ cause: String(e.cause) })),
          }),
        ),
    );

    return constant({
      createSecretKey,
      createUserApiKey,
      deleteSecretKey,
      getApiKeyById,
      getApiKeys,
      listUserApiKeys,
      revokeUserApiKey,
      rotateSecretKey,
      validatePublishableKey,
      validateSecretKey,
      validateUserApiKey,
    });
  }),
}) {
  static layer = Layer.effect(ApiKeyService)(ApiKeyService.make);
}
