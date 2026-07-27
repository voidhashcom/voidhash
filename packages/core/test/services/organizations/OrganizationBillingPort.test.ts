import { Effect } from "effect";
import { describe, it } from "vitest";

import { OrganizationBillingPort } from "@voidhash/core/services/organizations/OrganizationBillingPort";

describe("OrganizationBillingPort", () => {
  it("does nothing when the Community layer is installed", async () => {
    await Effect.gen(function* () {
      const port = yield* OrganizationBillingPort;
      yield* port.initializeOrganizationBilling({ organizationId: "org_community" });
    }).pipe(Effect.provide(OrganizationBillingPort.noop), Effect.runPromise);
  });
});
