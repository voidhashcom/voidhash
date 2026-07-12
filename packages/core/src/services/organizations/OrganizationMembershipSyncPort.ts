import { Db } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

/** Stable failure boundary for an organization-membership synchronization extension. */
export class OrganizationMembershipSyncPortError extends Schema.TaggedErrorClass<OrganizationMembershipSyncPortError>(
  "OrganizationMembershipSyncPortError",
)("OrganizationMembershipSyncPortError", { cause: Schema.String }) {}

export interface OrganizationMembershipSyncResult {
  readonly syncedMembershipIds: ReadonlyArray<string>;
  readonly syncedOrganizationIds: ReadonlyArray<string>;
}

export interface OrganizationMembershipSyncPortShape {
  readonly syncMemberships: (input: {
    readonly localUserId: string;
    readonly workosUserId: string;
  }) => Effect.Effect<OrganizationMembershipSyncResult, OrganizationMembershipSyncPortError, Db>;
}

/**
 * Extension point for mirroring external multi-user organization membership.
 * Community composition uses {@link noop}; Enterprise composition installs its
 * WorkOS-backed implementation.
 */
export class OrganizationMembershipSyncPort extends Context.Service<
  OrganizationMembershipSyncPort,
  OrganizationMembershipSyncPortShape
>()("core/OrganizationMembershipSyncPort") {
  static readonly noop = Layer.succeed(
    OrganizationMembershipSyncPort,
    OrganizationMembershipSyncPort.of({
      syncMemberships: () =>
        Effect.succeed({ syncedMembershipIds: [], syncedOrganizationIds: [] }),
    }),
  );
}
