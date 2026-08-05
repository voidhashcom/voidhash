/**
 * Provider-neutral identity mirrored into the local `user` table.
 *
 * Structurally a subset of the WorkOS `User` object so the WorkOS adapters can
 * pass SDK values through unchanged, but declared independently so core carries
 * no `@workos-inc/node` dependency and alternative identity providers (the
 * local development provider) can satisfy it.
 */
export interface LocalUserIdentity {
  readonly email: string;
  readonly emailVerified: boolean;
  /** Local user id previously linked back onto the provider record, when known. */
  readonly externalId: string | null;
  readonly firstName: string | null;
  /** Identity id as issued by the provider — stored as `user.workos_user_id`. */
  readonly id: string;
  readonly lastName: string | null;
  readonly profilePictureUrl: string | null;
}

export interface LocalUserAccess {
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly permissions: ReadonlyArray<string>;
    readonly slug: string;
    readonly workosOrganizationId: string;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly organizationId: string;
    readonly permissions: ReadonlyArray<string>;
    readonly slug: string;
  }>;
}
