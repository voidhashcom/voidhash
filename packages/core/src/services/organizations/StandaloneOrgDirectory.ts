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
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Str from "effect/String";

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

const splitName = (
  name: string,
): { firstName: Option.Option<string>; lastName: Option.Option<string> } => {
  const trimmed = name.trim();
  if (Str.isEmpty(trimmed)) return { firstName: Option.none(), lastName: Option.none() };
  const separator = trimmed.indexOf(" ");
  if (separator === -1) return { firstName: Option.some(trimmed), lastName: Option.none() };
  return {
    firstName: Option.some(trimmed.slice(0, separator)),
    lastName: Option.liftPredicate(trimmed.slice(separator + 1).trim(), Str.isNonEmpty),
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
          role: Option.fromNullishOr(input.roleSlug),
          userId: input.workosUserId,
        } satisfies OrgDirectoryMembership),

      createOrganization: (input) =>
        Effect.succeed({
          externalId: Option.some(input.externalId),
          id: toStandaloneOrganizationId(input.externalId),
          name: input.name,
        } satisfies OrgDirectoryOrganization),

      deleteMembership: () => Effect.void,

      deleteOrganization: () => Effect.void,

      findUserByEmail: (email) =>
        query(
          Effect.fn("StandaloneOrgDirectory.findUserByEmail")(function* () {
            const row = Option.fromNullishOr(
              yield* db.query.user.findFirst({
                where: { email: email.trim().toLowerCase() },
              }),
            );
            // A user who has never signed in has no provider id yet, which is
            // indistinguishable from "no such user" for this port's callers.
            if (Option.isNone(row)) return Option.none<OrgDirectoryUser>();
            const workosUserId = Option.fromNullishOr(row.value.workosUserId);
            if (Option.isNone(workosUserId)) return Option.none<OrgDirectoryUser>();
            const { firstName, lastName } = splitName(row.value.name);
            return Option.some({
              email: row.value.email,
              emailVerified: row.value.emailVerified,
              externalId: Option.some(row.value.id),
              firstName,
              id: workosUserId.value,
              lastName,
              profilePictureUrl: Option.orElse(Option.fromNullishOr(row.value.customImageUrl), () =>
                Option.fromNullishOr(row.value.image),
              ),
            } satisfies OrgDirectoryUser);
          })(),
        ),

      getOrganization: (workosOrganizationId) =>
        query(
          Effect.fn("StandaloneOrgDirectory.getOrganization")(function* () {
            const row = yield* db.query.organization.findFirst({
              where: { workosOrganizationId },
            });
            if (!row) {
              return yield* Effect.fail({
                message: `No local organization for ${workosOrganizationId}`,
              });
            }
            return {
              externalId: Option.some(row.id),
              id: row.workosOrganizationId,
              name: row.name,
            } satisfies OrgDirectoryOrganization;
          })(),
        ),

      getOrganizationByExternalId: (externalId) =>
        query(
          Effect.fn("StandaloneOrgDirectory.getOrganizationByExternalId")(function* () {
            return Option.map(
              Option.fromNullishOr(
                yield* db.query.organization.findFirst({ where: { id: externalId } }),
              ),
              (row) =>
                ({
                  externalId: Option.some(row.id),
                  id: row.workosOrganizationId,
                  name: row.name,
                }) satisfies OrgDirectoryOrganization,
            );
          })(),
        ),

      listMembershipsForUser: (workosUserId) =>
        query(
          Effect.fn("StandaloneOrgDirectory.listMembershipsForUser")(function* () {
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
                role: Option.fromNullishOr(row.role),
                userId: workosUserId,
              }),
            );
          })(),
        ),

      updateMembershipRole: (workosMembershipId, input) =>
        query(
          Effect.fn("StandaloneOrgDirectory.updateMembershipRole")(function* () {
            const rows = yield* db
              .select({
                workosOrganizationId: organization.workosOrganizationId,
                workosUserId: user.workosUserId,
              })
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .innerJoin(organization, eq(member.organizationId, organization.id))
              .where(eq(member.workosMembershipId, workosMembershipId));

            const row = Option.fromNullishOr(rows[0]);
            const workosUserId = Option.flatMap(row, (value) =>
              Option.fromNullishOr(value.workosUserId),
            );
            if (Option.isNone(row) || Option.isNone(workosUserId)) {
              return yield* Effect.fail({
                message: `No local membership for ${workosMembershipId}`,
              });
            }
            return {
              id: workosMembershipId,
              organizationId: row.value.workosOrganizationId,
              role: Option.some(input.roleSlug),
              userId: workosUserId.value,
            } satisfies OrgDirectoryMembership;
          })(),
        ),

      updateOrganization: (input) =>
        query(
          Effect.fn("StandaloneOrgDirectory.updateOrganization")(function* () {
            const row = Option.fromNullishOr(
              yield* db.query.organization.findFirst({
                where: { workosOrganizationId: input.workosOrganizationId },
              }),
            );
            return {
              externalId: Option.map(row, (value) => value.id),
              id: input.workosOrganizationId,
              name:
                input.name ??
                Option.getOrElse(
                  Option.map(row, (value) => value.name),
                  () => "",
                ),
            } satisfies OrgDirectoryOrganization;
          })(),
        ),
    };
  }),
);
