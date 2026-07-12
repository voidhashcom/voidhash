import { Db } from "@voidhash/db";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { OrganizationMembershipSyncPort } from "../../../src/services/organizations/OrganizationMembershipSyncPort.ts";

describe("OrganizationMembershipSyncPort", () => {
  it("does not import external memberships when the Community layer is installed", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* OrganizationMembershipSyncPort;
        return yield* sync.syncMemberships({
          localUserId: "user_1",
          workosUserId: "workos_user_1",
        });
      }).pipe(
        Effect.provide(OrganizationMembershipSyncPort.noop),
        Effect.provide(Layer.succeed(Db, {} as never)),
      ),
    );

    expect(result).toEqual({ syncedMembershipIds: [], syncedOrganizationIds: [] });
  });
});
