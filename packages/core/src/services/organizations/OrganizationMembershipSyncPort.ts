import { Db } from "@voidhash/db";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

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
      syncMemberships: () => Effect.succeed({ syncedMembershipIds: [], syncedOrganizationIds: [] }),
    }),
  );
}
