import type * as Option from "effect/Option";

/**
 * Provider-neutral identity mirrored into the local `user` table.
 *
 * Provider adapters normalize their nullable SDK values into `Option` before
 * crossing this boundary. The shape is declared independently so core carries
 * no `@workos-inc/node` dependency and alternative identity providers can
 * satisfy it.
 */
export interface LocalUserIdentity {
  readonly email: string;
  readonly emailVerified: boolean;
  /** Local user id previously linked back onto the provider record, when known. */
  readonly externalId: Option.Option<string>;
  readonly firstName: Option.Option<string>;
  /** Identity id as issued by the provider — stored as `user.workos_user_id`. */
  readonly id: string;
  readonly lastName: Option.Option<string>;
  readonly profilePictureUrl: Option.Option<string>;
}

export interface LocalUserAccess {
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly logo: Option.Option<string>;
    readonly name: string;
    readonly permissions: ReadonlyArray<string>;
    readonly slug: string;
    readonly workosOrganizationId: string;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly logo: Option.Option<string>;
    readonly name: string;
    readonly organizationId: string;
    readonly permissions: ReadonlyArray<string>;
    readonly slug: string;
  }>;
}
