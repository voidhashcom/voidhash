import * as Effect from "effect/Effect";
import { expect } from "vitest";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { stack, test } = CoreIntegrationTestHarness.make();

test(
  "deploys the backend stack",
  Effect.gen(function* () {
    const output = yield* stack;
    expect(output.backendUrl).toBeDefined();
    expect(output.hyperdriveId).toBeDefined();
    expect(output.mimicDbUrl).toBeDefined();
    expect(output.wwwUrl).toBeDefined();
    // Ephemeral stages expose credentials for the in-process harness layers.
    expect(output.testConnections).not.toBeNull();
    expect(output.testConnections?.db.host).toBeDefined();
    expect(output.testConnections?.clickhouse.url).toBeDefined();
    expect(output.testConnections?.workos.clientId).toBeDefined();
  }),
);
