import { Effect } from "effect";
import { describe, it } from "vitest";

import { OrganizationLifecyclePort } from "@voidhash/core/services/organizations/OrganizationLifecyclePort";

describe("OrganizationLifecyclePort", () => {
  it("does nothing when the Community layer is installed", async () => {
    await Effect.gen(function* () {
      const port = yield* OrganizationLifecyclePort;
      yield* port.organizationCreated({ organizationId: "org_community" });
    }).pipe(Effect.provide(OrganizationLifecyclePort.noop), Effect.runPromise);
  });
});
