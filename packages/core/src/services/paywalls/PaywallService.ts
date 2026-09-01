import { constant, pick } from "@voidhash/lib/lang";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  PaywallNotFoundError,
  PaywallSlugAlreadyExistsError,
} from "../../domain/paywall/Paywall.ts";
import {
  isOwnedPaywallThumbnailUrl,
  paywallThumbnailKeyFromUrl,
} from "../../domain/paywallThumbnail.ts";
import { AuditLogAction, AuditLogEntityType, Db, eq, paywalls } from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
export class PaywallServiceError extends Schema.TaggedErrorClass<PaywallServiceError>(
  "PaywallServiceError",
)("PaywallServiceError", { cause: Schema.String }) {}

/**
 * `PaywallService` orchestrates the paywall aggregate.
 *
 * Note: `createEditToken` is intentionally not migrated yet — it depends on
 * `MimicHostService`, whose dynamic Node module loading isn't Cloudflare-native
 * and is in the "medium" migration bucket. Callers that need an edit token
 * should keep using the `internal/` implementation until Mimic moves.
 *
 * `AuditLogPort`, `AuthSession`, `Db`, and `PublicFileStore` are provided by
 * the application root.
 */
export class PaywallService extends Context.Service<PaywallService>()("PaywallService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const db = yield* Db;
    const publicFileStore = yield* PublicFileStore;

    const getPaywalls = Effect.fn("getPaywalls")(
      function* (projectId: string, includeArchived = false) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const organizationId = session?.projects.find((p) => p.id === projectId)?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access paywalls for project ${projectId}`,
        );
        return yield* db.query.paywalls.findMany({
          where: {
            projectId,
            ...pick(includeArchived, {}, { archivedAt: { isNull: true } }),
          },
          orderBy: { createdAt: "desc" },
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getPaywallById = Effect.fn("getPaywallById")(
      function* (id: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.paywall.id", id);
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const paywall = yield* db.query.paywalls.findFirst({ where: { id } });
        if (!paywall) {
          return yield* Effect.fail(
            new PaywallNotFoundError({ message: `Paywall not found: ${id}` }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.paywall.slug", paywall.slug);
        const organizationId = session?.projects.find(
          (p) => p.id === paywall.projectId,
        )?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        yield* checkProjectPermission(
          paywall.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access paywall ${id} for project ${paywall.projectId}`,
        );
        return paywall;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const createPaywall = Effect.fn("createPaywall")(
      function* (input: {
        readonly projectId: string;
        readonly name: string;
        readonly slug: string;
      }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.paywall.slug", input.slug);
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const organizationId = session?.projects.find(
          (p) => p.id === input.projectId,
        )?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create paywalls for project ${input.projectId}`,
        );

        const existing = yield* db.query.paywalls.findFirst({
          where: { slug: input.slug, projectId: input.projectId },
        });
        if (existing) {
          return yield* Effect.fail(new PaywallSlugAlreadyExistsError({ slug: input.slug }));
        }

        const newPaywall = {
          id: generateId("paywall"),
          name: input.name,
          projectId: input.projectId,
          slug: input.slug,
        };
        yield* Effect.annotateCurrentSpan("voidhash.paywall.id", newPaywall.id);
        yield* db.insert(paywalls).values(newPaywall);

        yield* auditLog.append({
          projectId: input.projectId,
          entityType: AuditLogEntityType.Paywall,
          entityId: newPaywall.id,
          action: AuditLogAction.Created,
          changes: { snapshot: { name: input.name, slug: input.slug } },
        });

        yield* Effect.log(`Created paywall ${newPaywall.id} for project ${input.projectId}`);
        return { id: newPaywall.id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const deletePaywall = Effect.fn("deletePaywall")(
      function* (input: { readonly paywallId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.paywall.id", input.paywallId);
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        const paywall = yield* db.query.paywalls.findFirst({ where: { id: input.paywallId } });
        if (!paywall) {
          return yield* Effect.fail(
            new PaywallNotFoundError({
              message: `Paywall with id ${input.paywallId} not found`,
            }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.paywall.slug", paywall.slug);
        const organizationId = session?.projects.find(
          (p) => p.id === paywall.projectId,
        )?.organizationId;
        if (organizationId) {
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        }
        yield* checkProjectPermission(
          paywall.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete paywall ${input.paywallId}`,
        );

        yield* db.delete(paywalls).where(eq(paywalls.id, input.paywallId));

        // Best-effort cleanup of the owned thumbnail object, scoped to keys we
        // own for this project + paywall (mirrors PaywallAssetService.delete).
        const thumbnailUrl = Option.fromNullishOr(paywall.thumbnailUrl);
        if (
          isOwnedPaywallThumbnailUrl(
            thumbnailUrl,
            paywall.projectId,
            paywall.id,
            publicFileStore.publicBaseUrl,
          )
        ) {
          const thumbnailKey = Option.flatMap(thumbnailUrl, (url) =>
            paywallThumbnailKeyFromUrl(
              url,
              paywall.projectId,
              paywall.id,
              publicFileStore.publicBaseUrl,
            ),
          );
          if (Option.isSome(thumbnailKey)) {
            yield* publicFileStore.deleteObject(thumbnailKey.value).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning(
                  `Failed to delete paywall thumbnail object ${thumbnailKey.value}: ${Cause.pretty(cause)}`,
                ),
              ),
            );
          }
        }

        yield* auditLog.append({
          projectId: paywall.projectId,
          entityType: AuditLogEntityType.Paywall,
          entityId: input.paywallId,
          action: AuditLogAction.Deleted,
        });

        yield* Effect.log(`Deleted paywall ${input.paywallId}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /**
     * Loads a paywall for a mutating action, asserting it exists and the caller
     * may write to its project. Returns the row so callers can read the current
     * `projectId`/`slug` for spans and audit logs.
     */
    const loadPaywallForWrite = Effect.fn("loadPaywallForWrite")(function* (
      paywallId: string,
      action: string,
    ) {
      const session = yield* AuthSession;
      yield* Effect.annotateCurrentSpan("voidhash.paywall.id", paywallId);
      yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
      if (session?.user?.id) {
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
      }
      const paywall = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
      if (!paywall) {
        return yield* Effect.fail(
          new PaywallNotFoundError({ message: `Paywall with id ${paywallId} not found` }),
        );
      }
      yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);
      yield* Effect.annotateCurrentSpan("voidhash.paywall.slug", paywall.slug);
      const organizationId = session?.projects.find(
        (p) => p.id === paywall.projectId,
      )?.organizationId;
      if (organizationId) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
      }
      yield* checkProjectPermission(
        paywall.projectId,
        "project:all",
        `User ${session?.user?.id} is not authorized to ${action} paywall ${paywallId}`,
      );
      return paywall;
    });

    /**
     * Renames a paywall. The `slug` is deliberately immutable — it is the stable
     * identifier serving/analytics key off of — so only the human-facing `name`
     * changes here.
     */
    const renamePaywall = Effect.fn("renamePaywall")(
      function* (input: { readonly paywallId: string; readonly name: string }) {
        const paywall = yield* loadPaywallForWrite(input.paywallId, "rename");

        yield* db
          .update(paywalls)
          .set({ name: input.name })
          .where(eq(paywalls.id, input.paywallId));

        yield* auditLog.append({
          projectId: paywall.projectId,
          entityType: AuditLogEntityType.Paywall,
          entityId: input.paywallId,
          action: AuditLogAction.Updated,
          changes: { before: { name: paywall.name }, after: { name: input.name } },
        });

        yield* Effect.log(`Renamed paywall ${input.paywallId}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /**
     * Soft-deletes a paywall by stamping `archivedAt`. Archived paywalls drop out
     * of the default listing but remain restorable, so live showings never break
     * from a hard delete.
     */
    const archivePaywall = Effect.fn("archivePaywall")(
      function* (input: { readonly paywallId: string }) {
        const paywall = yield* loadPaywallForWrite(input.paywallId, "archive");

        const archivedAt = yield* DateTime.nowAsDate;
        yield* db.update(paywalls).set({ archivedAt }).where(eq(paywalls.id, input.paywallId));

        yield* auditLog.append({
          projectId: paywall.projectId,
          entityType: AuditLogEntityType.Paywall,
          entityId: input.paywallId,
          action: AuditLogAction.Archived,
        });

        yield* Effect.log(`Archived paywall ${input.paywallId}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /** Restores a previously archived paywall by clearing `archivedAt`. */
    const restorePaywall = Effect.fn("restorePaywall")(
      function* (input: { readonly paywallId: string }) {
        const paywall = yield* loadPaywallForWrite(input.paywallId, "restore");

        yield* db
          .update(paywalls)
          .set({ archivedAt: null })
          .where(eq(paywalls.id, input.paywallId));

        yield* auditLog.append({
          projectId: paywall.projectId,
          entityType: AuditLogEntityType.Paywall,
          entityId: input.paywallId,
          action: AuditLogAction.Restored,
        });

        yield* Effect.log(`Restored paywall ${input.paywallId}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PaywallServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return constant({
      archivePaywall,
      createPaywall,
      deletePaywall,
      getPaywallById,
      getPaywalls,
      renamePaywall,
      restorePaywall,
    });
  }),
}) {
  static layer = Layer.effect(PaywallService)(PaywallService.make);
}
