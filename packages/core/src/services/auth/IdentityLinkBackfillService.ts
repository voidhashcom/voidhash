import { Db, type User as DbUser } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import { OrganizationMembershipSyncPort } from "../organizations/OrganizationMembershipSyncPort.ts";
import { IdentityProvider } from "./IdentityProvider.ts";
import { LocalUserSessionService } from "./LocalUserSessionService.ts";

/** Stable authentication-facing error for local WorkOS synchronization failures. */
export class IdentityLinkBackfillError extends Schema.TaggedErrorClass<IdentityLinkBackfillError>(
  "IdentityLinkBackfillError",
)("IdentityLinkBackfillError", { cause: Schema.String }) {}

export interface IdentityLinkBackfillResult {
  readonly localUser: DbUser;
  readonly syncedMembershipIds: ReadonlyArray<string>;
  readonly syncedOrganizationIds: ReadonlyArray<string>;
}

export interface IdentityLinkBackfillServiceShape {
  readonly syncAuthenticatedUser: (
    identity: LocalUserIdentity,
  ) => Effect.Effect<IdentityLinkBackfillResult, IdentityLinkBackfillError, Db>;
}

/**
 * Mirrors an authenticated WorkOS identity into the local user table, then
 * delegates optional multi-user organization synchronization through
 * {@link OrganizationMembershipSyncPort}.
 */
export class IdentityLinkBackfillService extends Context.Service<
  IdentityLinkBackfillService,
  IdentityLinkBackfillServiceShape
>()("IdentityLinkBackfillService", {
  make: Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const membershipSync = yield* OrganizationMembershipSyncPort;
    const identityProvider = yield* IdentityProvider;

    const syncAuthenticatedUser = Effect.fn("IdentityLinkBackfillService.syncAuthenticatedUser")(
      function* (identity: LocalUserIdentity) {
        if (identity.id) yield* Effect.annotateCurrentSpan("voidhash.user.external_id", identity.id);

        const localUser = yield* localUserSessions.resolveLocalUser(identity);
        if (localUser.id) yield* Effect.annotateCurrentSpan("voidhash.user.id", localUser.id);

        yield* !identity.externalId
          ? identityProvider
              .linkExternalId(identity.id, localUser.id)
              .pipe(Effect.catch(() => Effect.void))
          : Effect.void;

        const synced = yield* membershipSync.syncMemberships({
          localUserId: localUser.id,
          workosUserId: identity.id,
        });

        return { localUser, ...synced } satisfies IdentityLinkBackfillResult;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new IdentityLinkBackfillError({ cause: String(error.cause ?? error.message) }),
              ),
            OrganizationMembershipSyncPortError: (error) =>
              Effect.fail(new IdentityLinkBackfillError({ cause: error.cause })),
          }),
        ),
    );

    return { syncAuthenticatedUser } as const;
  }),
}) {
  static layer = Layer.effect(IdentityLinkBackfillService)(IdentityLinkBackfillService.make);
}
