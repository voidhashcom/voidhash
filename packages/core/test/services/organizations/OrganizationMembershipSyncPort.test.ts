import { type Database, Db } from "@voidhash/db";
import { Effect, Layer } from "effect";

import { OrganizationMembershipSyncPort } from "../../../src/services/organizations/OrganizationMembershipSyncPort.ts";
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

/** The Community (noop) port never touches the database; only the type needs satisfying. */
const unusedDb = (stub: any): Database => stub;

describe("OrganizationMembershipSyncPort", () => {
  it.effect("does not import external memberships when the Community layer is installed", () =>
    Effect.gen(function* () {
      const sync = yield* OrganizationMembershipSyncPort;
      const result = yield* sync.syncMemberships({
        localUserId: "user_1",
        workosUserId: "workos_user_1",
      });

      expect(result).toEqual({ syncedMembershipIds: [], syncedOrganizationIds: [] });
    }).pipe(
      Effect.provide(OrganizationMembershipSyncPort.noop),
      Effect.provide(Layer.succeed(Db, unusedDb({}))),
    ),
  );
});
