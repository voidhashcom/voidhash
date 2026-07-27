import { Workos } from "@voidhash/core/services/auth/Workos";
import {
  WorkosOrgPort,
  WorkosOrgPortError,
} from "@voidhash/core/services/organizations/WorkosOrgPort";
import { Effect, Layer } from "effect";

const mapError = (error: { readonly cause?: unknown; readonly message: string }) =>
  new WorkosOrgPortError({ cause: String(error.cause), message: error.message });

const membership = (value: {
  readonly id: string;
  readonly organizationId: string;
  readonly role: string | { readonly slug?: string } | null;
  readonly userId: string;
}) => ({
  id: value.id,
  organizationId: value.organizationId,
  role: typeof value.role === "string" ? value.role : (value.role?.slug ?? null),
  userId: value.userId,
});

const organization = (value: {
  readonly externalId: string | null;
  readonly id: string;
  readonly name: string;
}) => ({ externalId: value.externalId, id: value.id, name: value.name });

/** WorkOS-backed organization-management port for BYO WorkOS credentials. */
export const WorkosOrgPortLive: Layer.Layer<WorkosOrgPort, never, Workos> = Layer.effect(
  WorkosOrgPort,
  Effect.gen(function* () {
    const workos = yield* Workos;
    return {
      createMembership: (input) =>
        workos.createOrganizationMembership(input).pipe(
          Effect.map(membership),
          Effect.mapError(mapError),
        ),
      createOrganization: (input) =>
        workos.createOrganization(input).pipe(
          Effect.map(organization),
          Effect.mapError(mapError),
        ),
      deleteMembership: (id) =>
        workos.deleteOrganizationMembership(id).pipe(Effect.mapError(mapError)),
      deleteOrganization: (id) => workos.deleteOrganization(id).pipe(Effect.mapError(mapError)),
      findUserByEmail: (email) => workos.findUserByEmail(email).pipe(Effect.mapError(mapError)),
      getOrganization: (id) =>
        workos.getOrganization(id).pipe(
          Effect.map(organization),
          Effect.mapError(mapError),
        ),
      getOrganizationByExternalId: (externalId) =>
        workos.getOrganizationByExternalId(externalId).pipe(
          Effect.map((value) => (value === null ? null : organization(value))),
          Effect.mapError(mapError),
        ),
      listMembershipsForUser: (userId) =>
        workos.listOrganizationMembershipsForUser(userId).pipe(
          Effect.map((values) => values.map(membership)),
          Effect.mapError(mapError),
        ),
      updateMembershipRole: (id, input) =>
        workos.updateOrganizationMembership(id, input).pipe(
          Effect.map(membership),
          Effect.mapError(mapError),
        ),
      updateOrganization: (input) =>
        workos.updateOrganization(input).pipe(
          Effect.map(organization),
          Effect.mapError(mapError),
        ),
    };
  }),
);
