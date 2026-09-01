import { SLUG_BLACKLIST } from "@voidhash/lib";
import { causeMessage, constant } from "@voidhash/lib/lang";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  avatarKeyFromUrl,
  avatarSha256Hex,
  deriveAvatarKey,
  isOwnedAvatarUrl,
  validateAndDecodeAvatar,
} from "../../domain/avatar.ts";
import { OrganizationNotFoundError } from "../../domain/organization/Organization.ts";
import { Db, eq, member, organization } from "@voidhash/db";
import { createShortId } from "../../utils/create-short-id.ts";
import { createSlug } from "../../utils/create-slug.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkOrganizationPermission } from "../../utils/permissions.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { OrganizationLifecyclePort } from "./OrganizationLifecyclePort.ts";
import { OrgDirectoryPort } from "./OrgDirectoryPort.ts";

/**
 * Catch-all service error. Wraps `DatabaseError`, `OrgDirectoryPortError`, and
 * other infrastructural failures at the public-method boundary so callers
 * see one stable error tag.
 */
export class OrganizationServiceError extends Schema.TaggedErrorClass<OrganizationServiceError>(
  "OrganizationServiceError",
)("OrganizationServiceError", { cause: Schema.String }) {}

/**
 * `OrganizationService` orchestrates the organization aggregate. WorkOS is
 * the source of truth: every create / update / delete write goes to WorkOS
 * first and is mirrored to the local DB only on success.
 * Webhooks reconcile any drift.
 *
 * `Db`, `OrgDirectoryPort`, `OrganizationLifecyclePort`, and `AuthSession` are
 * provided by the application root. Community deployments use the no-op
 * lifecycle port; hosted deployments provide their own lifecycle extension
 * without coupling this service to its implementation.
 */
export class OrganizationService extends Context.Service<OrganizationService>()(
  "OrganizationService",
  {
    make: Effect.gen(function* () {
      const workosOrgPort = yield* OrgDirectoryPort;
      const organizationLifecycle = yield* OrganizationLifecyclePort;
      const publicFileStore = yield* PublicFileStore;
      const db = yield* Db;

      /**
       * Stamps the acting identity (§2b) onto the current span. Guards every
       * nullable field so key sessions never emit `"null"` attributes. Ids /
       * pseudonymous distinct ids only — never the email/name (§5).
       */
      const annotateActor = Effect.fn("OrganizationService.annotateActor")(function* (
        session: typeof AuthSession.Service,
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        if (session.user?.workosUserId) {
          yield* Effect.annotateCurrentSpan("voidhash.user.external_id", session.user.workosUserId);
        }
        if (session.person?.distinctId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        }
      });

      const checkSlugAvailable = Effect.fn("OrganizationService.checkSlugAvailable")(function* (
        slug: string,
      ) {
        const existing = yield* db.query.organization.findFirst({ where: { slug } });
        return existing === undefined;
      });

      const resolveWorkosUserIdForSession = Effect.fn(
        "OrganizationService.resolveWorkosUserIdForSession",
      )(function* (sessionUser: {
        readonly email: string;
        readonly workosUserId: Option.Option<string>;
      }) {
        if (Option.isSome(sessionUser.workosUserId)) return sessionUser.workosUserId.value;

        const workosUser = yield* workosOrgPort.findUserByEmail(sessionUser.email);
        if (Option.isSome(workosUser)) return workosUser.value.id;

        return yield* Effect.fail(
          new OrganizationServiceError({
            cause:
              "Cannot create an organization without an authenticated WorkOS user (api-key sessions cannot create orgs).",
          }),
        );
      });

      const getOrganizationById = Effect.fn("getOrganizationById")(
        function* (id: string) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", id);
          const org = yield* db.query.organization.findFirst({ where: { id } });
          if (!org) {
            return yield* Effect.fail(new OrganizationNotFoundError({ organizationId: id }));
          }
          yield* Effect.annotateCurrentSpan("voidhash.organization.slug", org.slug);
          if (org.workosOrganizationId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.external_id",
              org.workosOrganizationId,
            );
          }
          yield* checkOrganizationPermission(
            id,
            "organization:all",
            `User ${session?.user?.id} is not authorized to access organization ${id}`,
          );
          return org;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getOrganizationBySlug = Effect.fn("getOrganizationBySlug")(
        function* (slug: string) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.slug", slug);
          const org = yield* db.query.organization.findFirst({ where: { slug } });
          if (!org) {
            return yield* Effect.fail(new OrganizationNotFoundError({ organizationId: slug }));
          }
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", org.id);
          if (org.workosOrganizationId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.external_id",
              org.workosOrganizationId,
            );
          }
          yield* checkOrganizationPermission(
            org.id,
            "organization:all",
            `User ${session?.user?.id} is not authorized to access organization ${org.id}`,
          );
          return org;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const createOrganization = Effect.fn("createOrganization")(
        function* (input: { readonly name: string }) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          const sessionUser = session.user;

          if (!sessionUser) {
            return yield* Effect.fail(
              new OrganizationServiceError({
                cause:
                  "An authenticated user session is required to create an organization (api-key sessions cannot create orgs).",
              }),
            );
          }
          const workosUserId = yield* resolveWorkosUserIdForSession({
            email: sessionUser.email,
            workosUserId: Option.fromNullishOr(sessionUser.workosUserId),
          });

          const baseSlug = createSlug(input.name);
          const initialSlug = SLUG_BLACKLIST.includes(baseSlug)
            ? `${baseSlug}-${createShortId()}`
            : baseSlug;
          type CheckSlugEffect = ReturnType<typeof checkSlugAvailable>;
          const findAvailableSlug: (
            candidate: string,
          ) => Effect.Effect<
            string,
            Effect.Error<CheckSlugEffect>,
            Effect.Services<CheckSlugEffect>
          > = (candidate) =>
            checkSlugAvailable(candidate).pipe(
              Effect.flatMap((available) =>
                available
                  ? Effect.succeed(candidate)
                  : Effect.suspend(() => findAvailableSlug(`${baseSlug}-${createShortId()}`)),
              ),
            );
          const slug = yield* findAvailableSlug(initialSlug);

          const orgId = generateId("organization");
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", orgId);
          yield* Effect.annotateCurrentSpan("voidhash.organization.slug", slug);

          // WorkOS create first. If this fails, no local state is created.
          const workosOrg = yield* workosOrgPort
            .createOrganization({ externalId: orgId, name: input.name })
            .pipe(
              Effect.tapError((error) =>
                Effect.log(
                  `WorkOS createOrganization failed for ${orgId} (${input.name}): ${error.message}`,
                ),
              ),
            );

          yield* Effect.log(`Created WorkOS org ${workosOrg.id} for ${orgId} (${input.name})`);
          yield* Effect.annotateCurrentSpan("voidhash.organization.external_id", workosOrg.id);

          const workosMembership = yield* workosOrgPort
            .createMembership({
              roleSlug: "admin",
              workosOrganizationId: workosOrg.id,
              workosUserId,
            })
            .pipe(
              Effect.tapError((error) =>
                Effect.log(
                  `WorkOS createMembership failed for user ${workosUserId} in org ${workosOrg.id}: ${error.message}`,
                ),
              ),
              Effect.tapError(() =>
                workosOrgPort
                  .deleteOrganization(workosOrg.id)
                  .pipe(
                    Effect.catch((rollbackError) =>
                      Effect.logWarning(
                        `Failed to roll back WorkOS org ${workosOrg.id} after membership-create failure: ${rollbackError.message}`,
                      ),
                    ),
                  ),
              ),
            );

          const now = yield* DateTime.nowAsDate;
          const ownerMembershipId = generateId("member");
          yield* Effect.annotateCurrentSpan("voidhash.member.id", ownerMembershipId);
          yield* Effect.annotateCurrentSpan("voidhash.member.external_id", workosMembership.id);
          yield* Effect.annotateCurrentSpan("voidhash.member.role", "owner");

          // Local mirror in a single transaction. On failure, compensate by
          // tearing down the WorkOS org so we don't leave an orphan.
          yield* db
            .transaction(
              Effect.fn("OrganizationService.createOrganization.transaction")(function* (tx) {
                yield* tx.insert(organization).values({
                  createdAt: now,
                  id: orgId,
                  logo: null,
                  metadata: null,
                  name: input.name,
                  slug,
                  workosOrganizationId: workosOrg.id,
                });
                yield* tx.insert(member).values({
                  createdAt: now,
                  id: ownerMembershipId,
                  organizationId: orgId,
                  role: "owner",
                  userId: sessionUser.id,
                  workosMembershipId: workosMembership.id,
                });
              }),
            )
            .pipe(
              Effect.tapError(() =>
                workosOrgPort
                  .deleteOrganization(workosOrg.id)
                  .pipe(
                    Effect.catch((rollbackError) =>
                      Effect.logWarning(
                        `Failed to roll back WorkOS org ${workosOrg.id} after local DB write failure: ${rollbackError.message}`,
                      ),
                    ),
                  ),
              ),
            );

          // Run the organization-created hook — non-fatal: log and continue if it fails.
          yield* organizationLifecycle
            .organizationCreated({
              email: sessionUser.email,
              organizationId: orgId,
            })
            .pipe(
              Effect.catch((error) =>
                Effect.logWarning(
                  `Failed to run the organization-created hook for org ${orgId}: ${causeMessage(error)}`,
                ),
              ),
            );

          return { id: orgId, name: input.name, slug };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
              OrgDirectoryPortError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: error.message })),
            }),
          ),
      );

      const updateOrganization = Effect.fn("updateOrganization")(
        function* (input: { readonly organizationId: string; readonly name: string }) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          const org = yield* db.query.organization.findFirst({
            where: { id: input.organizationId },
          });
          if (!org) {
            return yield* Effect.fail(
              new OrganizationNotFoundError({ organizationId: input.organizationId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.organization.slug", org.slug);
          if (org.workosOrganizationId) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.organization.external_id",
              org.workosOrganizationId,
            );
          }

          yield* checkOrganizationPermission(
            input.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`,
          );

          // WorkOS is the source of truth; mirror the rename there first.
          yield* workosOrgPort.updateOrganization({
            name: input.name,
            workosOrganizationId: org.workosOrganizationId,
          });

          yield* db
            .update(organization)
            .set({ name: input.name })
            .where(eq(organization.id, input.organizationId));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
              OrgDirectoryPortError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: error.message })),
            }),
          ),
      );

      const setAvatar = Effect.fn("setOrganizationAvatar")(
        function* (input: {
          readonly organizationId: string;
          readonly imageBase64: string;
          readonly contentType: string;
        }) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          const org = yield* db.query.organization.findFirst({
            where: { id: input.organizationId },
          });
          if (!org) {
            return yield* Effect.fail(
              new OrganizationNotFoundError({ organizationId: input.organizationId }),
            );
          }
          yield* checkOrganizationPermission(
            input.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`,
          );

          const { bytes, ext } = yield* validateAndDecodeAvatar(input);
          const sha256 = yield* avatarSha256Hex(bytes);
          const key = deriveAvatarKey("organization", input.organizationId, sha256, ext);

          yield* publicFileStore.putObject({
            key,
            body: bytes,
            contentType: Option.some(input.contentType),
          });
          const logoUrl = publicFileStore.publicUrl(key);

          yield* db
            .update(organization)
            .set({ logo: logoUrl })
            .where(eq(organization.id, input.organizationId));

          // Best-effort cleanup of the superseded object (only our own keys).
          const existingLogo = Option.fromNullishOr(org.logo);
          if (isOwnedAvatarUrl(existingLogo, publicFileStore.publicBaseUrl)) {
            const oldKey = Option.flatMap(existingLogo, (logo) =>
              avatarKeyFromUrl(logo, publicFileStore.publicBaseUrl),
            );
            if (Option.isSome(oldKey) && oldKey.value !== key) {
              const oldKeyValue = oldKey.value;
              yield* publicFileStore
                .deleteObject(oldKeyValue)
                .pipe(
                  Effect.catchCause((cause) =>
                    Effect.logWarning(
                      `Failed to delete superseded avatar object ${String(oldKeyValue)}: ${Cause.pretty(cause)}`,
                    ),
                  ),
                );
            }
          }

          return { logoUrl };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
              PublicFileStoreError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: error.cause })),
            }),
          ),
      );

      const removeAvatar = Effect.fn("removeOrganizationAvatar")(
        function* (input: { readonly organizationId: string }) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          const org = yield* db.query.organization.findFirst({
            where: { id: input.organizationId },
          });
          if (!org) {
            return yield* Effect.fail(
              new OrganizationNotFoundError({ organizationId: input.organizationId }),
            );
          }
          yield* checkOrganizationPermission(
            input.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`,
          );

          yield* db
            .update(organization)
            .set({ logo: null })
            .where(eq(organization.id, input.organizationId));

          const existingLogo = Option.fromNullishOr(org.logo);
          if (isOwnedAvatarUrl(existingLogo, publicFileStore.publicBaseUrl)) {
            const oldKey = Option.flatMap(existingLogo, (logo) =>
              avatarKeyFromUrl(logo, publicFileStore.publicBaseUrl),
            );
            if (Option.isSome(oldKey)) {
              const oldKeyValue = oldKey.value;
              yield* publicFileStore
                .deleteObject(oldKeyValue)
                .pipe(
                  Effect.catchCause((cause) =>
                    Effect.logWarning(
                      `Failed to delete superseded avatar object ${String(oldKeyValue)}: ${Cause.pretty(cause)}`,
                    ),
                  ),
                );
            }
          }
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const deleteOrganization = Effect.fn("deleteOrganization")(
        function* (input: { readonly organizationId: string }) {
          const session = yield* AuthSession;
          yield* annotateActor(session);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          yield* checkOrganizationPermission(
            input.organizationId,
            "organization:all",
            `User ${session?.user?.id} is not authorized to delete organization ${input.organizationId}`,
          );

          const org = yield* db.query.organization.findFirst({
            where: { id: input.organizationId },
          });

          if (org) {
            if (org.workosOrganizationId) {
              yield* Effect.annotateCurrentSpan(
                "voidhash.organization.external_id",
                org.workosOrganizationId,
              );
            }
            yield* workosOrgPort.deleteOrganization(org.workosOrganizationId);
          }

          yield* db.delete(organization).where(eq(organization.id, input.organizationId));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: String(error.cause) })),
              OrgDirectoryPortError: (error) =>
                Effect.fail(new OrganizationServiceError({ cause: error.message })),
            }),
          ),
      );

      return constant({
        createOrganization,
        deleteOrganization,
        getOrganizationById,
        getOrganizationBySlug,
        removeAvatar,
        setAvatar,
        updateOrganization,
      });
    }),
  },
) {
  static layer = Layer.effect(OrganizationService)(OrganizationService.make);
}
