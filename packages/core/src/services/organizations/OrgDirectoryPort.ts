import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link OrgDirectoryPort} operations. Adapters wrap any
 * `@workos-inc/node` failure into this single tag so the
 * {@link OrganizationService} catch boundary stays small.
 */
export class OrgDirectoryPortError extends Schema.TaggedErrorClass<OrgDirectoryPortError>(
  "OrgDirectoryPortError",
)("OrgDirectoryPortError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface OrgDirectoryOrganization {
  readonly id: string;
  readonly name: string;
  readonly externalId: string | null;
}

export interface OrgDirectoryMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string | null;
}

export interface OrgDirectoryUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly externalId: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly profilePictureUrl: string | null;
}

export interface OrgDirectoryPortShape {
  readonly createOrganization: (input: {
    readonly name: string;
    readonly externalId: string;
  }) => Effect.Effect<OrgDirectoryOrganization, OrgDirectoryPortError>;

  readonly updateOrganization: (input: {
    readonly workosOrganizationId: string;
    readonly name?: string;
  }) => Effect.Effect<OrgDirectoryOrganization, OrgDirectoryPortError>;

  readonly deleteOrganization: (
    workosOrganizationId: string,
  ) => Effect.Effect<void, OrgDirectoryPortError>;

  readonly getOrganizationByExternalId: (
    externalId: string,
  ) => Effect.Effect<OrgDirectoryOrganization | null, OrgDirectoryPortError>;

  /** Fetches a WorkOS organization by its WorkOS id. */
  readonly getOrganization: (
    workosOrganizationId: string,
  ) => Effect.Effect<OrgDirectoryOrganization, OrgDirectoryPortError>;

  readonly createMembership: (input: {
    readonly workosOrganizationId: string;
    readonly workosUserId: string;
    readonly roleSlug?: string;
  }) => Effect.Effect<OrgDirectoryMembership, OrgDirectoryPortError>;

  /** Lists active WorkOS organization memberships for a WorkOS user. */
  readonly listMembershipsForUser: (
    workosUserId: string,
  ) => Effect.Effect<ReadonlyArray<OrgDirectoryMembership>, OrgDirectoryPortError>;

  readonly updateMembershipRole: (
    workosMembershipId: string,
    input: { readonly roleSlug: string },
  ) => Effect.Effect<OrgDirectoryMembership, OrgDirectoryPortError>;

  readonly deleteMembership: (
    workosMembershipId: string,
  ) => Effect.Effect<void, OrgDirectoryPortError>;

  readonly findUserByEmail: (
    email: string,
  ) => Effect.Effect<OrgDirectoryUser | null, OrgDirectoryPortError>;
}

/**
 * Provider-agnostic port for the subset of WorkOS operations
 * the organization lifecycle, identity sync, and membership services need.
 * The full live adapter (against `@workos-inc/node`) is wired by the
 * application root, keeping business logic provider-neutral and trivially
 * fakeable in tests.
 */
export class OrgDirectoryPort extends Context.Service<OrgDirectoryPort, OrgDirectoryPortShape>()(
  "OrgDirectoryPort",
) {}
