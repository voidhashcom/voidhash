import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link WorkosOrgPort} operations. Adapters wrap any
 * `@workos-inc/node` failure into this single tag so the
 * {@link OrganizationService} catch boundary stays small.
 */
export class WorkosOrgPortError extends Schema.TaggedErrorClass<WorkosOrgPortError>(
  "WorkosOrgPortError",
)("WorkosOrgPortError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface WorkosPortOrganization {
  readonly id: string;
  readonly name: string;
  readonly externalId: string | null;
}

export interface WorkosPortMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string | null;
}

export interface WorkosPortUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly externalId: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly profilePictureUrl: string | null;
}

export interface WorkosOrgPortShape {
  readonly createOrganization: (input: {
    readonly name: string;
    readonly externalId: string;
  }) => Effect.Effect<WorkosPortOrganization, WorkosOrgPortError>;

  readonly updateOrganization: (input: {
    readonly workosOrganizationId: string;
    readonly name?: string;
  }) => Effect.Effect<WorkosPortOrganization, WorkosOrgPortError>;

  readonly deleteOrganization: (
    workosOrganizationId: string,
  ) => Effect.Effect<void, WorkosOrgPortError>;

  readonly getOrganizationByExternalId: (
    externalId: string,
  ) => Effect.Effect<WorkosPortOrganization | null, WorkosOrgPortError>;

  /** Fetches a WorkOS organization by its WorkOS id. */
  readonly getOrganization: (
    workosOrganizationId: string,
  ) => Effect.Effect<WorkosPortOrganization, WorkosOrgPortError>;

  readonly createMembership: (input: {
    readonly workosOrganizationId: string;
    readonly workosUserId: string;
    readonly roleSlug?: string;
  }) => Effect.Effect<WorkosPortMembership, WorkosOrgPortError>;

  /** Lists active WorkOS organization memberships for a WorkOS user. */
  readonly listMembershipsForUser: (
    workosUserId: string,
  ) => Effect.Effect<ReadonlyArray<WorkosPortMembership>, WorkosOrgPortError>;

  readonly updateMembershipRole: (
    workosMembershipId: string,
    input: { readonly roleSlug: string },
  ) => Effect.Effect<WorkosPortMembership, WorkosOrgPortError>;

  readonly deleteMembership: (
    workosMembershipId: string,
  ) => Effect.Effect<void, WorkosOrgPortError>;

  readonly findUserByEmail: (
    email: string,
  ) => Effect.Effect<WorkosPortUser | null, WorkosOrgPortError>;
}

/**
 * Provider-agnostic port for the subset of WorkOS operations
 * the organization lifecycle, identity sync, and membership services need.
 * The full live adapter (against `@workos-inc/node`) is wired by the
 * application root, keeping business logic provider-neutral and trivially
 * fakeable in tests.
 */
export class WorkosOrgPort extends Context.Service<WorkosOrgPort, WorkosOrgPortShape>()(
  "WorkosOrgPort",
) {}
