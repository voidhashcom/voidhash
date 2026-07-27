import { Db } from "@voidhash/db";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { OrganizationMembershipWebhookPort } from "../../../src/services/organizations/OrganizationMembershipWebhookPort.ts";

describe("OrganizationMembershipWebhookPort", () => {
  it("does not project multi-user membership events in Community composition", async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const projection = yield* OrganizationMembershipWebhookPort;
          yield* projection.processEvent({
            _tag: "Upsert",
            membership: {
              externalId: "workos_membership_1",
              externalOrganizationId: "workos_organization_1",
              externalUserId: "workos_user_1",
              role: "member",
            },
          });
        }).pipe(
          Effect.provide(OrganizationMembershipWebhookPort.noop),
          Effect.provide(Layer.succeed(Db, {} as never)),
        ),
      ),
    ).resolves.toBeUndefined();
  });
});
