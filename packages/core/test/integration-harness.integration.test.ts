import * as Effect from "effect/Effect";
import { expect } from "vitest";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { stack, test } = CoreIntegrationTestHarness.make();

test(
  "shares the environment contract with the suite",
  Effect.gen(function* () {
    const output = yield* stack;
    // The composition (self-host locally, richer stacks downstream) must
    // expose credentials for the in-process harness layers.
    expect(output.testConnections).not.toBeNull();
    expect(output.testConnections?.db.host).toBeDefined();
    expect(output.testConnections?.clickhouse.url).toBeDefined();
  }),
);
