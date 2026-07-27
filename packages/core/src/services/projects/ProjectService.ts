import { SLUG_BLACKLIST } from "@voidhash/lib";
import { Cause, Context, Effect, Layer, Schema } from "effect";

import { AuthenticationError, AuthSession } from "../../domain/auth/Auth.ts";
import {
  avatarKeyFromUrl,
  avatarSha256Hex,
  deriveAvatarKey,
  isOwnedAvatarUrl,
  validateAndDecodeAvatar,
} from "../../domain/avatar.ts";
import { ProjectNotFoundError } from "../../domain/project/Project.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  apiKeys,
  eq,
  organization,
  projects,
} from "@voidhash/db";
import { createShortId } from "../../utils/create-short-id.ts";
import { createSlug } from "../../utils/create-slug.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkOrganizationPermission, checkProjectPermission } from "../../utils/permissions.ts";
import { createPublishableKey } from "../apiKeys/api-keys.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
export class ProjectServiceError extends Schema.TaggedErrorClass<ProjectServiceError>(
  "ProjectServiceError",
)("ProjectServiceError", { cause: Schema.String }) {}

/**
 * `ProjectService` orchestrates the project aggregate within an organization.
 *
 * `createProject` writes the project row plus a bootstrap publishable API key
 * inside a single transaction — the project would otherwise have no auth
 * surface — and is the documented exception that lets the service yield `Db`
 * for `db.transaction(...)` directly.
 *
 * `AuditLogPort`, `AuthSession`, and `Db` are provided by the application
 * root.
 */
export class ProjectService extends Context.Service<ProjectService>()("ProjectService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const publicFileStore = yield* PublicFileStore;
    const db = yield* Db;

    /**
     * Stamps the actor dimension (`voidhash.auth.method`, `voidhash.user.id`,
     * `voidhash.person.distinct_id`) onto the current span. Nullable identity
     * fields are only attached when present so no `"null"` placeholder lands.
     */
    const annotateActor = Effect.fnUntraced(function* () {
      const session = yield* AuthSession;
      yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
      if (session.user?.id) {
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
      }
      if (session.person?.distinctId) {
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", session.person.distinctId);
      }
      return session;
    });

    const getProjectById = Effect.fn("getProjectById")(
      function* (id: string) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.project.id", id);
        const project = yield* db.query.projects.findFirst({ where: { id } });
        if (!project) {
          return null;
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", project.slug);
        yield* Effect.annotateCurrentSpan(
          "voidhash.project.organization_id",
          project.organizationId,
        );
        yield* checkProjectPermission(
          id,
          "project:all",
          `User ${session?.user?.id} is not authorized to access project ${id}`,
        );
        return project;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getProjectBySlug = Effect.fn("getProjectBySlug")(
      function* (input: { readonly organizationId: string; readonly slug: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", input.slug);
        const project = yield* db.query.projects.findFirst({
          where: { slug: input.slug, organizationId: input.organizationId },
        });
        if (!project) {
          return null;
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);
        yield* checkProjectPermission(
          project.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to access project ${project.id}`,
        );
        return project;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getProjectBySlugAndOrganizationSlug = Effect.fn("getProjectBySlugAndOrganizationSlug")(
      function* (input: { readonly organizationSlug: string; readonly projectSlug: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.organization.slug", input.organizationSlug);
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", input.projectSlug);
        const org = yield* db.query.organization.findFirst({
          where: { slug: input.organizationSlug },
        });
        if (!org) {
          return null;
        }
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", org.id);
        const project = yield* db.query.projects.findFirst({
          where: { slug: input.projectSlug, organizationId: org.id },
        });
        if (!project) {
          return null;
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);
        yield* checkProjectPermission(
          project.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to access project ${project.id}`,
        );
        return project;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getProjects = Effect.fn("getProjects")(
      function* (organizationId: string) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
        yield* checkOrganizationPermission(
          organizationId,
          "organization:all",
          `User ${session?.user?.id} is not authorized to access projects for organization ${organizationId}`,
        );
        const projectsList = yield* db.query.projects.findMany({
          where: { organizationId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.project.count", projectsList.length);
        return projectsList;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getProjectsByOrganizationSlug = Effect.fn("getProjectsByOrganizationSlug")(
      function* (organizationSlug: string) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.organization.slug", organizationSlug);
        const org = yield* db.query.organization.findFirst({
          where: { slug: organizationSlug },
        });
        if (!org) {
          return null;
        }
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", org.id);
        yield* checkOrganizationPermission(
          org.id,
          "organization:all",
          `User ${session?.user?.id} is not authorized to access organization ${org.id}`,
        );
        const projectsList = yield* db.query.projects.findMany({
          where: { organizationId: org.id },
        });
        yield* Effect.annotateCurrentSpan("voidhash.project.count", projectsList.length);
        return projectsList;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const createProject = Effect.fn("createProject")(
      function* (input: { readonly name: string; readonly organizationId: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
        yield* checkOrganizationPermission(
          input.organizationId,
          "organization:all",
          `User ${session?.user?.id} is not authorized to create projects for organization ${input.organizationId}`,
        );

        const userId = session?.user?.id;
        if (!userId) {
          return yield* Effect.fail(
            new AuthenticationError({
              cause: "You are not authenticated",
              message: "You are not authenticated",
            }),
          );
        }

        const id = generateId("project");
        yield* Effect.annotateCurrentSpan("voidhash.project.id", id);
        let slug = createSlug(input.name);
        if (SLUG_BLACKLIST.includes(slug)) {
          slug = `${slug}-${createShortId()}`;
        }

        const existingProject = yield* db.query.projects.findFirst({
          where: { slug, organizationId: input.organizationId },
        });
        if (existingProject) {
          slug = `${slug}-${createShortId()}`;
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", slug);

        const apiKeyId = generateId("apiPublishableKey");
        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.insert(projects).values({
              createdByUserId: userId,
              id,
              name: input.name,
              organizationId: input.organizationId,
              slug,
            });

            const productionPublishableKey = yield* createPublishableKey();
            yield* tx.insert(apiKeys).values({
              id: apiKeyId,
              projectId: id,
              name: "Publishable key",
              ...productionPublishableKey,
            });
          }),
        );
        yield* Effect.annotateCurrentSpan("voidhash.api_key.id", apiKeyId);

        yield* auditLog
          .append({
            projectId: id,
            entityType: AuditLogEntityType.Project,
            entityId: id,
            action: AuditLogAction.Created,
            changes: { snapshot: { id, name: input.name, slug } },
          })
          .pipe(Effect.ignore);
        yield* Effect.annotateCurrentSpan("voidhash.audit_log.entity_id", id);

        yield* Effect.log(`Created project ${id} for organization ${input.organizationId}`);
        return { id, name: input.name, slug };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
            SqlError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const updateProject = Effect.fn("updateProject")(
      function* (input: { readonly id: string; readonly name: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.id);
        const project = yield* db.query.projects.findFirst({ where: { id: input.id } });
        if (!project) {
          return yield* Effect.fail(new ProjectNotFoundError({ projectId: input.id }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", project.slug);
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", project.organizationId);
        yield* checkProjectPermission(
          input.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to update project ${input.id}`,
        );

        yield* db.update(projects).set({ name: input.name }).where(eq(projects.id, input.id));

        yield* auditLog.append({
          projectId: input.id,
          entityType: AuditLogEntityType.Project,
          entityId: input.id,
          action: AuditLogAction.Updated,
          changes: { snapshot: { name: input.name } },
        });
        yield* Effect.annotateCurrentSpan("voidhash.audit_log.entity_id", input.id);

        yield* Effect.log(`Updated project ${input.id}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const setAvatar = Effect.fn("setProjectAvatar")(
      function* (input: {
        readonly id: string;
        readonly imageBase64: string;
        readonly contentType: string;
      }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.id);
        const project = yield* db.query.projects.findFirst({ where: { id: input.id } });
        if (!project) {
          return yield* Effect.fail(new ProjectNotFoundError({ projectId: input.id }));
        }
        yield* checkProjectPermission(
          input.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to update project ${input.id}`,
        );

        const { bytes, ext } = yield* validateAndDecodeAvatar(input);
        const sha256 = yield* avatarSha256Hex(bytes);
        const key = deriveAvatarKey("project", input.id, sha256, ext);

        yield* publicFileStore.putObject({ key, body: bytes, contentType: input.contentType });
        const logoUrl = publicFileStore.publicUrl(key);

        yield* db.update(projects).set({ logo: logoUrl }).where(eq(projects.id, input.id));

        // Best-effort cleanup of the superseded object (only our own keys).
        if (
          project.logo !== null &&
          isOwnedAvatarUrl(project.logo, publicFileStore.publicBaseUrl)
        ) {
          const oldKey = avatarKeyFromUrl(project.logo, publicFileStore.publicBaseUrl);
          if (oldKey !== null && oldKey !== key) {
            yield* publicFileStore
              .deleteObject(oldKey)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(
                    `Failed to delete superseded avatar object ${oldKey}: ${Cause.pretty(cause)}`,
                  ),
                ),
              );
          }
        }

        yield* auditLog.append({
          projectId: input.id,
          entityType: AuditLogEntityType.Project,
          entityId: input.id,
          action: AuditLogAction.Updated,
          changes: { snapshot: { logo: logoUrl } },
        });

        yield* Effect.log(`Updated avatar for project ${input.id}`);
        return { logoUrl };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
            PublicFileStoreError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: error.cause })),
          }),
        ),
    );

    const removeAvatar = Effect.fn("removeProjectAvatar")(
      function* (input: { readonly id: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.id);
        const project = yield* db.query.projects.findFirst({ where: { id: input.id } });
        if (!project) {
          return yield* Effect.fail(new ProjectNotFoundError({ projectId: input.id }));
        }
        yield* checkProjectPermission(
          input.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to update project ${input.id}`,
        );

        yield* db.update(projects).set({ logo: null }).where(eq(projects.id, input.id));

        if (
          project.logo !== null &&
          isOwnedAvatarUrl(project.logo, publicFileStore.publicBaseUrl)
        ) {
          const oldKey = avatarKeyFromUrl(project.logo, publicFileStore.publicBaseUrl);
          if (oldKey !== null) {
            yield* publicFileStore
              .deleteObject(oldKey)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(
                    `Failed to delete superseded avatar object ${oldKey}: ${Cause.pretty(cause)}`,
                  ),
                ),
              );
          }
        }

        yield* auditLog.append({
          projectId: input.id,
          entityType: AuditLogEntityType.Project,
          entityId: input.id,
          action: AuditLogAction.Updated,
          changes: { snapshot: { logo: null } },
        });

        yield* Effect.log(`Removed avatar for project ${input.id}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const deleteProject = Effect.fn("deleteProject")(
      function* (input: { readonly id: string }) {
        const session = yield* annotateActor();
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.id);
        const project = yield* db.query.projects.findFirst({ where: { id: input.id } });
        if (!project) {
          return yield* Effect.fail(new ProjectNotFoundError({ projectId: input.id }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.slug", project.slug);
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", project.organizationId);
        yield* checkProjectPermission(
          input.id,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete project ${input.id}`,
        );

        yield* db.delete(projects).where(eq(projects.id, input.id));

        yield* auditLog.append({
          projectId: input.id,
          entityType: AuditLogEntityType.Project,
          entityId: input.id,
          action: AuditLogAction.Deleted,
        });
        yield* Effect.annotateCurrentSpan("voidhash.audit_log.entity_id", input.id);

        yield* Effect.log(`Deleted project ${input.id}`);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProjectServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return {
      createProject,
      deleteProject,
      getProjectById,
      getProjectBySlug,
      getProjectBySlugAndOrganizationSlug,
      getProjects,
      getProjectsByOrganizationSlug,
      removeAvatar,
      setAvatar,
      updateProject,
    } as const;
  }),
}) {
  static layer = Layer.effect(ProjectService)(ProjectService.make);
}
