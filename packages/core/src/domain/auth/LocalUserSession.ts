import type { User as WorkOSUser } from "@workos-inc/node";

export type LocalUserIdentity = Pick<
  WorkOSUser,
  "email" | "emailVerified" | "externalId" | "firstName" | "id" | "lastName" | "profilePictureUrl"
>;

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
