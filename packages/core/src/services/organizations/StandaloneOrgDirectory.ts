/**
 * Local development implementation of {@link OrgDirectoryPort}.
 *
 * There is no external directory in local mode, so organization and membership
 * writes are accepted as-is and the port synthesizes the provider-side ids that
 * `organization.workos_organization_id` and `member.workos_membership_id`
 * require (both are `NOT NULL UNIQUE`). Deriving them from the local ids keeps
 * the mapping stable and collision-free without a schema change.
 *
 * Reads are answered from the local tables, which in this mode are the only
 * source of truth.
 */
import { Db, eq, member, organization, user } from "@voidhash/db";
import { Effect, Layer } from "effect";

import { generateId } from "../../utils/generate-id.ts";
import {
  OrgDirectoryPort,
  OrgDirectoryPortError,
  type OrgDirectoryMembership,
  type OrgDirectoryOrganization,
  type OrgDirectoryUser,
} from "./OrgDirectoryPort.ts";

const LOCAL_ORGANIZATION_PREFIX = "local_org_";
const LOCAL_MEMBERSHIP_PREFIX = "local_mem_";

/** Provider-side organization id synthesized from the local organization id. */
export const toStandaloneOrganizationId = (externalId: string): string =>
  `${LOCAL_ORGANIZATION_PREFIX}${externalId}`;

const splitName = (name: string): { firstName: string | null; lastName: string | null } => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { firstName: null, lastName: null };
  const separator = trimmed.indexOf(" ");
  if (separator === -1) return { firstName: trimmed, lastName: null };
  return {
    firstName: trimmed.slice(0, separator),
    lastName: trimmed.slice(separator + 1).trim() || null,
  };
};

/** {@link OrgDirectoryPort} backed entirely by the local database. */
export const StandaloneOrgDirectoryLive: Layer.Layer<OrgDirectoryPort, never, Db> = Layer.effect(
  OrgDirectoryPort,
  Effect.gen(function* () {
    // Captured at layer build so the port's methods keep the empty requirement
    // channel the shape declares.
    const db = yield* Db;

    const query = <A>(effect: Effect.Effect<A, { readonly message: string }, Db>) =>
      Effect.provideService(effect, Db, db).pipe(
        Effect.mapError(
          (error) =>
            new OrgDirectoryPortError({
              cause: String(error.message),
              message: "Local organization directory query failed",
            }),
        ),
      );

    return {
      createMembership: (input) =>
        Effect.succeed({
          id: `${LOCAL_MEMBERSHIP_PREFIX}${generateId("member")}`,
          organizationId: input.workosOrganizationId,
          role: input.roleSlug ?? null,
          userId: input.workosUserId,
        } satisfies OrgDirectoryMembership),

      createOrganization: (input) =>
        Effect.succeed({
          externalId: input.externalId,
          id: toStandaloneOrganizationId(input.externalId),
          name: input.name,
        } satisfies OrgDirectoryOrganization),

      deleteMembership: () => Effect.void,

      deleteOrganization: () => Effect.void,

      findUserByEmail: (email) =>
        query(
          Effect.gen(function* () {
            const row = yield* db.query.user.findFirst({
              where: { email: email.trim().toLowerCase() },
            });
            // A user who has never signed in has no provider id yet, which is
            // indistinguishable from "no such user" for this port's callers.
            if (!row?.workosUserId) return null;
            const { firstName, lastName } = splitName(row.name);
            return {
              email: row.email,
              emailVerified: row.emailVerified,
              externalId: row.id,
              firstName,
              id: row.workosUserId,
              lastName,
              profilePictureUrl: row.customImageUrl ?? row.image ?? null,
            } satisfies OrgDirectoryUser;
          }),
        ),

      getOrganization: (workosOrganizationId) =>
        query(
          Effect.gen(function* () {
            const row = yield* db.query.organization.findFirst({
              where: { workosOrganizationId },
            });
            if (!row) {
              return yield* Effect.fail({
                message: `No local organization for ${workosOrganizationId}`,
              });
            }
            return {
              externalId: row.id,
              id: row.workosOrganizationId,
              name: row.name,
            } satisfies OrgDirectoryOrganization;
          }),
        ),

      getOrganizationByExternalId: (externalId) =>
        query(
          Effect.gen(function* () {
            const row = yield* db.query.organization.findFirst({ where: { id: externalId } });
            if (row === undefined) {
              return null;
            }
            return {
              externalId: row.id,
              id: row.workosOrganizationId,
              name: row.name,
            } satisfies OrgDirectoryOrganization;
          }),
        ),

      listMembershipsForUser: (workosUserId) =>
        query(
          Effect.gen(function* () {
            const rows = yield* db
              .select({
                membershipId: member.workosMembershipId,
                role: member.role,
                workosOrganizationId: organization.workosOrganizationId,
              })
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .innerJoin(organization, eq(member.organizationId, organization.id))
              .where(eq(user.workosUserId, workosUserId));

            return rows.map(
              (row): OrgDirectoryMembership => ({
                id: row.membershipId,
                organizationId: row.workosOrganizationId,
                role: row.role,
                userId: workosUserId,
              }),
            );
          }),
        ),

      updateMembershipRole: (workosMembershipId, input) =>
        query(
          Effect.gen(function* () {
            const rows = yield* db
              .select({
                workosOrganizationId: organization.workosOrganizationId,
                workosUserId: user.workosUserId,
              })
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .innerJoin(organization, eq(member.organizationId, organization.id))
              .where(eq(member.workosMembershipId, workosMembershipId));

            const row = rows[0];
            if (!row?.workosUserId) {
              return yield* Effect.fail({
                message: `No local membership for ${workosMembershipId}`,
              });
            }
            return {
              id: workosMembershipId,
              organizationId: row.workosOrganizationId,
              role: input.roleSlug,
              userId: row.workosUserId,
            } satisfies OrgDirectoryMembership;
          }),
        ),

      updateOrganization: (input) =>
        query(
          Effect.gen(function* () {
            const row = yield* db.query.organization.findFirst({
              where: { workosOrganizationId: input.workosOrganizationId },
            });
            return {
              externalId: row?.id ?? null,
              id: input.workosOrganizationId,
              name: input.name ?? row?.name ?? "",
            } satisfies OrgDirectoryOrganization;
          }),
        ),
    };
  }),
);
