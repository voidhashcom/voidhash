import { ALLOWED_CHILDREN_BY_NODE_TYPE, type NodeType } from "@voidhash/mimic-schema";
import { nodeStyleFields } from "@voidhash/ai-shared";
import { describe, expect, it } from "vite-plus/test";

import { paywallAuthoringSkill } from "./paywall-authoring.ts";

/**
 * Contract test for the GENERATED sections of the paywall-authoring skill. It
 * introspects the mimic schema the SAME way the generator does, so it fails the
 * instant the generator silently drops a style field (e.g. a schema kind it does
 * not handle) or the containment listing drifts from `ALLOWED_CHILDREN_BY_NODE_TYPE`.
 * This is the whole point of generating the reference from the schema — the test
 * pins the generator to the source of truth, not to a hand-written expectation.
 */

/** The node types whose full style reference the skill ships. */
const STYLED_NODE_TYPES: readonly NodeType[] = ["screen", "view", "text", "shape", "path"];

const skill = paywallAuthoringSkill();

describe("paywallAuthoringSkill — generated style reference", () => {
  for (const type of STYLED_NODE_TYPES) {
    it(`lists every style field of \`${type}\``, () => {
      const fields = nodeStyleFields(type);
      // A styled node type must contribute at least one field — a schema kind the
      // generator can't introspect would collapse this to empty and this catches it.
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(
          skill.includes(`\`${field}\``),
          `style field "${field}" of node type "${type}" is missing from the generated skill`,
        ).toBe(true);
      }
    });
  }

  it("surfaces designer-internal flag fields (no longer hidden from the model)", () => {
    // The drift these fields expose is the whole point: they are real, settable
    // style fields the schema declares, so generating from the schema means the
    // model finally sees them.
    expect(skill).toContain("`backgroundEnabled`");
    expect(skill).toContain("`safeAreaTop`");
    expect(skill).toContain("`borderEnabled`");
  });

  it("enumerates enum literal values (e.g. flexDirection)", () => {
    // flexDirection is `Either(Literal("row"), Literal("column"))` — the generator
    // renders the literal set so the model knows the allowed values.
    expect(skill).toContain('"row" | "column"');
  });

  it("annotates the auto-managed `*Enabled` flag fields", () => {
    // The AI edit path derives these flags, so the reference tells the model it
    // only ever writes them to hide a group (explicit `false`).
    expect(skill).toContain("AUTO-MANAGED");
    expect(skill).toContain("set to true automatically when you set any background field");
    expect(skill).toContain("set to true automatically when you set any fill field");
  });
});

describe("paywallAuthoringSkill — generated containment reference", () => {
  it("matches ALLOWED_CHILDREN_BY_NODE_TYPE for every authorable parent", () => {
    // root/library/codeComponent are engine-managed and intentionally omitted.
    const authorable: readonly NodeType[] = (
      Object.keys(ALLOWED_CHILDREN_BY_NODE_TYPE) as NodeType[]
    ).filter((type) => type !== "root" && type !== "library" && type !== "codeComponent");

    for (const type of authorable) {
      const children = ALLOWED_CHILDREN_BY_NODE_TYPE[type];
      if (children.length > 0) {
        const expected = `\`${type}\` may contain: ${children
          .map((child) => `\`${child}\``)
          .join(", ")}`;
        expect(
          skill.includes(expected),
          `containment line for "${type}" drifted from ALLOWED_CHILDREN_BY_NODE_TYPE`,
        ).toBe(true);
      } else {
        expect(skill).toContain(`\`${type}\` is a leaf (no child nodes).`);
      }
    }
  });

  it("does not list engine-managed node types as authorable parents", () => {
    expect(skill).not.toContain("`root` may contain");
    expect(skill).not.toContain("`library` may contain");
    expect(skill).not.toContain("`codeComponent` may contain");
  });
});

describe("paywallAuthoringSkill — visual review discipline", () => {
  it("documents rendered inspection, screenshot checkpoints, and gated completion", () => {
    expect(skill).toContain("`get_rendered_layout` measures reality");
    expect(skill).toContain("`get_preview_screenshot` is the visual checkpoint");
    expect(skill).toContain("`finish_design` is the completion gate");
    expect(skill).toContain("Hierarchy and story");
    expect(skill).toContain("Offer clarity");
    expect(skill).toContain("Viewport fit");
    expect(skill).toContain("Purchase affordances");
  });
});
