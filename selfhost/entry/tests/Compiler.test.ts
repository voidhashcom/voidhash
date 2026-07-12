import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeNodeComponentCompiler } from "../src/compiler/CompilerCore.ts";

const compiler = makeNodeComponentCompiler();

const validComponent = `
  import { defineComponent } from "@voidhash/paywalls";
  export default defineComponent({
    title: "Hero",
    props: (p) => ({ heading: p.string().default("Go Pro") }),
    actions: () => ({}),
    previews: { default: {} },
    render: () => null,
  });
`;

describe("self-host component compiler", () => {
  it("compiles and extracts a component manifest", async () => {
    const result = await Effect.runPromise(compiler.compileAndExtract(validComponent));

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.manifest).toMatchObject({ manifestVersion: 2, title: "Hero" });
    }
  });

  it("classifies source and runtime failures without escaping", async () => {
    const compile = await Effect.runPromise(
      compiler.compileAndExtract("export default function Hero() { return <View>; }"),
    );
    const runtime = await Effect.runPromise(
      compiler.compileAndExtract('throw new Error("boom"); export default {};'),
    );

    expect(compile).toMatchObject({ phase: "compile", status: "error" });
    expect(runtime).toMatchObject({ phase: "runtime", status: "error" });
  });

  it("bounds evaluation and disables dynamic code generation", async () => {
    const loop = await Effect.runPromise(
      compiler.compileAndExtract("while (true) {} export default {};"),
    );
    const dynamicCode = await Effect.runPromise(
      compiler.compileAndExtract('Function("return 1")(); export default {};'),
    );

    expect(loop).toMatchObject({ phase: "runtime", status: "error" });
    expect(dynamicCode).toMatchObject({ phase: "runtime", status: "error" });
    if (loop.status === "error") {
      expect(loop.diagnostics[0]?.message).toContain("timed out");
    }
    if (dynamicCode.status === "error") {
      expect(dynamicCode.diagnostics[0]?.message).toContain("Code generation from strings disallowed");
    }
  });
});
