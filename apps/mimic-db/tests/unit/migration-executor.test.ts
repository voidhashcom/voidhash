import type { Value } from "@voidhash/mimic-core";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  evaluateBundledMigration,
  LocalMigrationExecutorLive,
  MigrationExecutor,
} from "../../src/core/migration-executor.ts";

// A migration "bundle" of the shape `MigrationBundler` emits: a self-contained
// script that registers a runner on `globalThis`. We exercise the QuickJS/vm
// replacement directly — it must run with no `node:vm`.
const ADD_COUNT_BUNDLE = `
globalThis.__MIMIC_RUN_MIGRATION__ = function (input) {
  var fields = Object.assign({}, input.oldValue.fields, {
    count: { kind: "number", value: 42 },
  });
  return { value: { kind: "object", fields: fields } };
};
`;

const oldValue: Value = {
  kind: "object",
  fields: { title: { kind: "string", value: "Hello" } },
};

describe("migration executor (node:vm / quickjs replacement)", () => {
  it("evaluates a bundled migration in an isolated scope", () => {
    const result = evaluateBundledMigration(ADD_COUNT_BUNDLE, oldValue);
    expect((result as any).fields.count).toEqual({ kind: "number", value: 42 });
    expect((result as any).fields.title).toEqual({ kind: "string", value: "Hello" });
    // The host realm must be untouched by the bundle's globalThis assignment.
    expect((globalThis as any).__MIMIC_RUN_MIGRATION__).toBeUndefined();
  });

  it("runs through the MigrationExecutor service", async () => {
    const value = await Effect.runPromise(
      Effect.gen(function* () {
        const executor = yield* MigrationExecutor;
        return yield* executor.run(ADD_COUNT_BUNDLE, oldValue);
      }).pipe(Effect.provide(LocalMigrationExecutorLive)),
    );
    expect((value as any).fields.count).toEqual({ kind: "number", value: 42 });
  });

  it("fails with MigrationFailedError when the bundle registers no runner", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const executor = yield* MigrationExecutor;
        return yield* executor.run("// no runner", oldValue);
      }).pipe(Effect.provide(LocalMigrationExecutorLive)),
    );
    expect(exit._tag).toBe("Failure");
  });
});
