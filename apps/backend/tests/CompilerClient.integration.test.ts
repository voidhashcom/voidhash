import { ComponentCompiler } from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Config, Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeHttpComponentCompilerLive } from "../src/compiler/CompilerClient.ts";

// The compiler is part of the provisioned stack, so a missing URL is a broken
// environment rather than a reason to skip.
const compilerUrl = Config.string("SELFHOST_COMPILER_URL").pipe(
  Config.withDefault("http://127.0.0.1:5002"),
  Effect.orDie,
);

describe("self-host component compiler client", () => {
  it("round-trips compile and extraction results through HTTP", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const url = yield* compilerUrl;
        const result = yield* Effect.gen(function* () {
          const compiler = yield* ComponentCompiler;
          return yield* compiler.compileAndExtract(`
          import { defineComponent } from "@voidhash/paywalls";
          export default defineComponent({
            title: "Client Card",
            props: () => ({}),
            actions: () => ({}),
            previews: { default: {} },
            render: () => null,
          });
          `);
        }).pipe(Effect.provide(makeHttpComponentCompilerLive(url)));

        expect(result.status).toBe("ready");
        if (result.status === "ready") {
          expect(result.manifest).toMatchObject({ manifestVersion: 2, title: "Client Card" });
        }
      }),
    ));
});
