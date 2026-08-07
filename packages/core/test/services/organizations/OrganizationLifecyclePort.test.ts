import { Effect } from "effect";

import { OrganizationLifecyclePort } from "@voidhash/core/services/organizations/OrganizationLifecyclePort";

import { describe, it } from "../../../src/testing/effect-vitest.ts";

describe("OrganizationLifecyclePort", () => {
  it.effect("does nothing when the Community layer is installed", () =>
    Effect.gen(function* () {
      const port = yield* OrganizationLifecyclePort;
      yield* port.organizationCreated({ organizationId: "org_community" });
    }).pipe(Effect.provide(OrganizationLifecyclePort.noop)),
  );
});
