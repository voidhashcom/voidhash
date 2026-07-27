import { Db, type User as DbUser } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import { OrganizationMembershipSyncPort } from "../organizations/OrganizationMembershipSyncPort.ts";
import { LocalUserSessionService } from "./LocalUserSessionService.ts";
import { Workos } from "./Workos.ts";

/** Stable authentication-facing error for local WorkOS synchronization failures. */
export class WorkosLocalSyncServiceError extends Schema.TaggedErrorClass<WorkosLocalSyncServiceError>(
  "WorkosLocalSyncServiceError",
)("WorkosLocalSyncServiceError", { cause: Schema.String }) {}

export interface WorkosLocalSyncResult {
  readonly localUser: DbUser;
  readonly syncedMembershipIds: ReadonlyArray<string>;
  readonly syncedOrganizationIds: ReadonlyArray<string>;
}

export interface WorkosLocalSyncServiceShape {
  readonly syncAuthenticatedUser: (
    identity: LocalUserIdentity,
  ) => Effect.Effect<WorkosLocalSyncResult, WorkosLocalSyncServiceError, Db>;
}

/**
 * Mirrors an authenticated WorkOS identity into the local user table, then
 * delegates optional multi-user organization synchronization through
 * {@link OrganizationMembershipSyncPort}.
 */
export class WorkosLocalSyncService extends Context.Service<
  WorkosLocalSyncService,
  WorkosLocalSyncServiceShape
>()("WorkosLocalSyncService", {
  make: Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const membershipSync = yield* OrganizationMembershipSyncPort;
    const workos = yield* Workos;

    const syncAuthenticatedUser = Effect.fn("WorkosLocalSyncService.syncAuthenticatedUser")(
      function* (identity: LocalUserIdentity) {
        if (identity.id) yield* Effect.annotateCurrentSpan("voidhash.user.workos_id", identity.id);

        const localUser = yield* localUserSessions.resolveLocalUser(identity);
        if (localUser.id) yield* Effect.annotateCurrentSpan("voidhash.user.id", localUser.id);

        yield* !identity.externalId
          ? workos
              .setUserExternalId(identity.id, localUser.id)
              .pipe(Effect.catch(() => Effect.void))
          : Effect.void;

        const synced = yield* membershipSync.syncMemberships({
          localUserId: localUser.id,
          workosUserId: identity.id,
        });

        return { localUser, ...synced } satisfies WorkosLocalSyncResult;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(
                new WorkosLocalSyncServiceError({ cause: String(error.cause ?? error.message) }),
              ),
            OrganizationMembershipSyncPortError: (error) =>
              Effect.fail(new WorkosLocalSyncServiceError({ cause: error.cause })),
          }),
        ),
    );

    return { syncAuthenticatedUser } as const;
  }),
}) {
  static layer = Layer.effect(WorkosLocalSyncService)(WorkosLocalSyncService.make);
}
