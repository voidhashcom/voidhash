import { describe, expect, it } from "vitest";

import { makeReadSkillTool, renderSkillDisclosure, type SkillSource } from "../src/SkillSource.ts";

const source: SkillSource = {
  list: () => [{ name: "design-paywall", description: "Use <care> & precision" }],
  read: (name) => (name === "design-paywall" ? "# Design Paywall\n\nFull body." : undefined),
};

describe("SkillSource", () => {
  it("renders escaped progressive-disclosure metadata", () => {
    expect(renderSkillDisclosure(source)).toContain("<name>design-paywall</name>");
    expect(renderSkillDisclosure(source)).toContain("Use &lt;care&gt; &amp; precision");
  });

  it("reads complete bodies through the Pi tool", async () => {
    const tool = makeReadSkillTool(source);
    await expect(tool.execute("call-1", { name: "design-paywall" })).resolves.toEqual({
      content: [{ type: "text", text: "# Design Paywall\n\nFull body." }],
      details: { name: "design-paywall" },
    });
    await expect(tool.execute("call-2", { name: "missing" })).rejects.toThrow(
      "Unknown skill: missing",
    );
  });
});
