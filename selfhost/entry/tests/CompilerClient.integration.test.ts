import { ComponentCompiler } from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeHttpComponentCompilerLive } from "../src/compiler/CompilerClient.ts";

const compilerUrl = process.env.SELFHOST_COMPILER_URL;
const describeCompiler = compilerUrl ? describe : describe.skip;

describeCompiler("self-host component compiler client", () => {
  it("round-trips compile and extraction results through HTTP", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(makeHttpComponentCompilerLive(compilerUrl ?? ""))),
    );

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.manifest).toMatchObject({ manifestVersion: 2, title: "Client Card" });
    }
  });
});
