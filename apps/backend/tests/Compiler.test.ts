import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeNodeComponentCompiler } from "../src/compiler/CompilerCore.ts";

const compiler = makeNodeComponentCompiler();

const validComponent = `
  import { defineComponent, Text } from "@voidhash/paywalls";
  export default defineComponent({
    title: "Hero",
    props: (p) => ({ heading: p.string().default("Go Pro") }),
    actions: () => ({}),
    previews: { default: {} },
    render: ({ props }) => <Text>{props.heading}</Text>,
  });
`;

describe("self-host component compiler", () => {
  it("compiles and extracts a component manifest", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* compiler.compileAndExtract(validComponent);

        expect(result.status).toBe("ready");
        if (result.status === "ready") {
          expect(result.manifest).toMatchObject({ manifestVersion: 2, title: "Hero" });
          expect(result.previewTrees.default).toMatchObject({
            treeVersion: 2,
            state: "default",
            root: { type: "text", text: "Go Pro", style: {} },
          });
        }
      }),
    ));

  it("classifies source and runtime failures without escaping", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const compile = yield* compiler.compileAndExtract(
          "export default function Hero() { return <View>; }",
        );
        const runtime = yield* compiler.compileAndExtract(
          'throw new Error("boom"); export default {};',
        );

        expect(compile).toMatchObject({ phase: "compile", status: "error" });
        expect(runtime).toMatchObject({ phase: "runtime", status: "error" });
      }),
    ));

  it("bounds evaluation and disables dynamic code generation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const loop = yield* compiler.compileAndExtract("while (true) {} export default {};");
        const dynamicCode = yield* compiler.compileAndExtract(
          'Function("return 1")(); export default {};',
        );

        expect(loop).toMatchObject({ phase: "runtime", status: "error" });
        expect(dynamicCode).toMatchObject({ phase: "runtime", status: "error" });
        if (loop.status === "error") {
          expect(loop.diagnostics[0]?.message).toContain("timed out");
        }
        if (dynamicCode.status === "error") {
          expect(dynamicCode.diagnostics[0]?.message).toContain(
            "Code generation from strings disallowed",
          );
        }
      }),
    ));
});
