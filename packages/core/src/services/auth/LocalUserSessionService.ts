import { Context, Effect, Layer } from "effect";

import {
  Db,
  type DbError,
  eq,
  inArray,
  member,
  organization,
  projects,
  user,
  type User as DbUser,
} from "@voidhash/db";

import type { LocalUserAccess, LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import { generateId } from "../../utils/generate-id.ts";

const toLocalUserName = (identity: LocalUserIdentity): string => {
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : identity.email;
};

export class LocalUserSessionService extends Context.Service<LocalUserSessionService>()(
  "core/LocalUserSessionService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      /**
       * Resolves a WorkOS identity to the local user row, creating or updating
       * it when needed. The WorkOS user id (`identity.id`) is matched against
       * our own `workos_user_id` column — never treated as a local primary key.
       * Email is the fallback match for rows whose `workos_user_id` has not been
       * backfilled yet (e.g. created before the column existed), and the column
       * is backfilled whenever such a row is matched.
       */
      const resolveLocalUser = (identity: LocalUserIdentity): Effect.Effect<DbUser, DbError, Db> =>
        Effect.gen(function* () {
          const matchedByWorkosId = yield* db.query.user.findFirst({
            where: { workosUserId: identity.id },
          });

          const matchedUser =
            matchedByWorkosId ??
            (yield* db.query.user.findFirst({
              where: { email: identity.email },
            }));

          const nextName = toLocalUserName(identity);
          const nextImage = identity.profilePictureUrl ?? null;

          if (matchedUser) {
            const needsUpdate =
              matchedUser.email !== identity.email ||
              matchedUser.emailVerified !== identity.emailVerified ||
              matchedUser.image !== nextImage ||
              matchedUser.name !== nextName ||
              matchedUser.workosUserId !== identity.id;

            if (needsUpdate) {
              yield* db
                .update(user)
                .set({
                  email: identity.email,
                  emailVerified: identity.emailVerified,
                  image: nextImage,
                  name: nextName,
                  workosUserId: identity.id,
                })
                .where(eq(user.id, matchedUser.id));

              return {
                ...matchedUser,
                email: identity.email,
                emailVerified: identity.emailVerified,
                image: nextImage,
                name: nextName,
                workosUserId: identity.id,
              } satisfies DbUser;
            }

            return matchedUser;
          }

          const createdUser: DbUser = {
            banned: false,
            banExpires: null,
            banReason: null,
            createdAt: new Date(),
            customImageUrl: null,
            email: identity.email,
            emailVerified: identity.emailVerified,
            id: generateId("user"),
            image: nextImage,
            name: nextName,
            role: null,
            updatedAt: new Date(),
            workosUserId: identity.id,
          };

          // A brand-new user can be resolved by several authenticated paths at
          // once right after sign-up — the dashboard's first load, the WorkOS
          // `user.created` webhook, and the eager post-sign-up provisioning —
          // and they all miss the lookups above and race to INSERT the same
          // (unique) email + `workos_user_id`. Upsert so the losing inserts
          // become no-ops instead of failing with a duplicate-key
          // `DatabaseError` (which surfaced as "Failed to authenticate due to a
          // database error"), then read back the row that actually persisted:
          // each racer generates its own local `id`, so the winning `id` may
          // not be the one we just built.
          yield* db
            .insert(user)
            .values(createdUser)
            // The INSERT can collide on EITHER the unique email OR the unique
            // workos_user_id. Postgres ON CONFLICT targets a single
            // constraint, so DO NOTHING (no target) absorbs any unique
            // violation as a no-op; the row that actually persisted is read
            // back below.
            .onConflictDoNothing();

          // Read back by EITHER unique key: the prior MySQL upsert healed
          // `email` to `identity.email` on any duplicate, but DO NOTHING leaves
          // the surviving row untouched, so a collision resolved on
          // `workos_user_id` (rather than `email`) is only found via that key.
          const persistedUser = yield* db.query.user.findFirst({
            where: {
              OR: [{ email: identity.email }, { workosUserId: identity.id }],
            },
          });

          return persistedUser ?? createdUser;
        });

      /** Loads the organizations and projects available to a local user. */
      const loadUserAccess = (userId: string): Effect.Effect<LocalUserAccess, DbError, Db> =>
        Effect.gen(function* () {
          const memberships = yield* db
            .select({
              organizationId: organization.id,
              organizationLogo: organization.logo,
              organizationName: organization.name,
              organizationSlug: organization.slug,
              workosOrganizationId: organization.workosOrganizationId,
            })
            .from(member)
            .innerJoin(organization, eq(member.organizationId, organization.id))
            .where(eq(member.userId, userId));

          const organizationIds = memberships.map((membership) => membership.organizationId);
          const accessibleProjects =
            organizationIds.length === 0
              ? []
              : yield* db
                  .select({
                    id: projects.id,
                    logo: projects.logo,
                    name: projects.name,
                    organizationId: projects.organizationId,
                    slug: projects.slug,
                  })
                  .from(projects)
                  .where(inArray(projects.organizationId, organizationIds));

          return {
            organizations: memberships.map((membership) => ({
              id: membership.organizationId,
              logo: membership.organizationLogo ?? null,
              name: membership.organizationName,
              permissions: ["organization:all"],
              slug: membership.organizationSlug ?? membership.organizationId,
              workosOrganizationId: membership.workosOrganizationId,
            })),
            projects: accessibleProjects.map((project) => ({
              id: project.id,
              logo: project.logo ?? null,
              name: project.name,
              organizationId: project.organizationId,
              permissions: ["project:all"],
              slug: project.slug,
            })),
          };
        });

      /** Converts a local user row and loaded access into an RPC-compatible user session. */
      const toUserSession = (
        dbUser: DbUser,
        access: LocalUserAccess,
        cookie: string | null,
        workosUserId: string | null,
      ) => ({
        cookie,
        method: "user" as const,
        name: `${dbUser.name} <${dbUser.email}>`,
        organizations: access.organizations,
        person: null,
        projects: access.projects,
        user: {
          createdAt: dbUser.createdAt,
          email: dbUser.email,
          emailVerified: dbUser.emailVerified,
          id: dbUser.id,
          // A user-uploaded avatar (never touched by the WorkOS sync) overrides
          // the WorkOS profile picture mirrored into `image`.
          image: dbUser.customImageUrl ?? dbUser.image ?? null,
          name: dbUser.name,
          role: dbUser.role ?? null,
          updatedAt: dbUser.updatedAt,
          workosUserId,
        },
      });

      /** Fetches a local user by id. */
      const getLocalUser = (userId: string): Effect.Effect<DbUser | undefined, DbError, Db> =>
        Effect.gen(function* () {
          return yield* db.query.user.findFirst({
            where: { id: userId },
          });
        });

      return {
        getLocalUser,
        loadUserAccess,
        resolveLocalUser,
        toUserSession,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(LocalUserSessionService)(LocalUserSessionService.make);
}
