import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { PerkNotFoundError, PerkSlugAlreadyExistsError } from "../../domain/perk/Perk.ts";
import { AuditLogAction, AuditLogEntityType, Db, eq, perks } from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error
 * tag.
 */
export class PerkServiceError extends Schema.TaggedErrorClass<PerkServiceError>("PerkServiceError")(
  "PerkServiceError",
  { cause: Schema.String },
) {}

/**
 * `PerkService` orchestrates the perk catalog aggregate. Five operations:
 * `getPerks`, `getPerkById`, `createPerk`, `updatePerk`, `deletePerk`. Every
 * write emits an audit-log entry and invalidates the project's cached schema
 * after the DB write succeeds.
 *
 * `AuditLogPort`, `AuthSession`, `Db`, and `SchemaCacheInvalidationService`
 * are provided by the application root.
 */
export class PerkService extends Context.Service<PerkService>()("PerkService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const schemaCache = yield* SchemaCacheInvalidationService;
    const db = yield* Db;

    const getPerks = Effect.fn("getPerks")(
      function* (projectId: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access perks for project ${projectId}`,
        );
        return yield* db.query.perks.findMany({ where: { projectId } });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getPerkById = Effect.fn("getPerkById")(
      function* (id: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.perk.id", id);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        const perk = yield* db.query.perks.findFirst({ where: { id } });
        if (!perk) {
          return yield* Effect.fail(new PerkNotFoundError({ message: "Perk not found" }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", perk.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.perk.slug", perk.slug);
        yield* checkProjectPermission(
          perk.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access perk ${id} for project ${perk.projectId}`,
        );
        return perk;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const createPerk = Effect.fn("createPerk")(
      function* (input: {
        readonly projectId: string;
        readonly name: string;
        readonly slug: string;
      }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.perk.slug", input.slug);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create perks for project ${input.projectId}`,
        );

        const existing = yield* db.query.perks.findFirst({
          where: { slug: input.slug, projectId: input.projectId },
        });
        if (existing) {
          return yield* Effect.fail(new PerkSlugAlreadyExistsError({ slug: input.slug }));
        }

        const newPerk = {
          id: generateId("perk"),
          name: input.name,
          projectId: input.projectId,
          slug: input.slug,
        };
        yield* Effect.annotateCurrentSpan("voidhash.perk.id", newPerk.id);
        yield* db.insert(perks).values(newPerk);

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.Perk,
            entityId: newPerk.id,
            action: AuditLogAction.Created,
            changes: { snapshot: { name: input.name, slug: input.slug } },
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Created perk ${newPerk.id} for project ${input.projectId}`);
        yield* schemaCache.invalidate(input.projectId);
        return { id: newPerk.id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const updatePerk = Effect.fn("updatePerk")(
      function* (input: {
        readonly id: string;
        readonly projectId: string;
        readonly name: string;
        readonly slug: string;
      }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.perk.id", input.id);
        yield* Effect.annotateCurrentSpan("voidhash.perk.slug", input.slug);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to update perks for project ${input.projectId}`,
        );

        const existing = yield* db.query.perks.findFirst({
          where: { slug: input.slug, projectId: input.projectId },
        });
        if (existing && existing.id !== input.id) {
          return yield* Effect.fail(new PerkSlugAlreadyExistsError({ slug: input.slug }));
        }

        yield* db
          .update(perks)
          .set({ name: input.name, slug: input.slug })
          .where(eq(perks.id, input.id));

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.Perk,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { snapshot: { name: input.name, slug: input.slug } },
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Updated perk ${input.id} for project ${input.projectId}`);
        yield* schemaCache.invalidate(input.projectId);
        return { id: input.id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const deletePerk = Effect.fn("deletePerk")(
      function* (input: { readonly perkId: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.perk.id", input.perkId);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        const perk = yield* db.query.perks.findFirst({ where: { id: input.perkId } });
        if (!perk) {
          return yield* Effect.fail(
            new PerkNotFoundError({ message: `Perk with id ${input.perkId} not found` }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", perk.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.perk.slug", perk.slug);
        yield* checkProjectPermission(
          perk.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete perk ${input.perkId}`,
        );

        yield* db.delete(perks).where(eq(perks.id, input.perkId));

        yield* auditLog
          .append({
            projectId: perk.projectId,
            entityType: AuditLogEntityType.Perk,
            entityId: input.perkId,
            action: AuditLogAction.Deleted,
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Deleted perk ${input.perkId}`);
        yield* schemaCache.invalidate(perk.projectId);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PerkServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return {
      getPerks,
      getPerkById,
      createPerk,
      updatePerk,
      deletePerk,
    } as const;
  }),
}) {
  static layer = Layer.effect(PerkService)(PerkService.make);
}
