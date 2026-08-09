import { type Database, Db } from "@voidhash/db";
import { Effect, Layer } from "effect";

import { OrganizationMembershipWebhookPort } from "../../../src/services/organizations/OrganizationMembershipWebhookPort.ts";
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

/** The Community (noop) port never touches the database; only the type needs satisfying. */
const unusedDb = (stub: any): Database => stub;

describe("OrganizationMembershipWebhookPort", () => {
  it.effect("does not project multi-user membership events in Community composition", () =>
    Effect.gen(function* () {
      const projection = yield* OrganizationMembershipWebhookPort;
      const result = yield* projection.processEvent({
        _tag: "Upsert",
        membership: {
          externalId: "workos_membership_1",
          externalOrganizationId: "workos_organization_1",
          externalUserId: "workos_user_1",
          role: "member",
        },
      });

      expect(result).toBeUndefined();
    }).pipe(
      Effect.provide(OrganizationMembershipWebhookPort.noop),
      Effect.provide(Layer.succeed(Db, unusedDb({}))),
    ),
  );
});
