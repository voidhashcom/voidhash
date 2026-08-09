import { causeMessage } from "@voidhash/lib/lang";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeReadSkillTool, renderSkillDisclosure, type SkillSource } from "../src/SkillSource.ts";

const source: SkillSource = {
  list: () => [{ name: "design-paywall", description: "Use <care> & precision" }],
  read: (name) => {
    if (name === "design-paywall") return "# Design Paywall\n\nFull body.";
    return undefined;
  },
};

describe("SkillSource", () => {
  it("renders escaped progressive-disclosure metadata", () => {
    expect(renderSkillDisclosure(source)).toContain("<name>design-paywall</name>");
    expect(renderSkillDisclosure(source)).toContain("Use &lt;care&gt; &amp; precision");
  });

  it("reads complete bodies through the Pi tool", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const tool = makeReadSkillTool(source);
        const body = yield* Effect.promise(() =>
          tool.execute("call-1", { name: "design-paywall" }),
        );
        expect(body).toEqual({
          content: [{ type: "text", text: "# Design Paywall\n\nFull body." }],
          details: { name: "design-paywall" },
        });

        const message = yield* Effect.flip(
          Effect.tryPromise({
            try: () => tool.execute("call-2", { name: "missing" }),
            catch: causeMessage,
          }),
        );
        expect(message).toBe("Unknown skill: missing");
      }),
    ));
});
