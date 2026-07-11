import { describe, expect, it } from "vite-plus/test";

import { designerSystemPrompt, systemPromptForSurface } from "./surfaces.ts";

/**
 * Cover the dynamic designer context block appended to the system prompt: the
 * base prompt without context, the paywall listing (slug + name + code
 * components), the open-paywall block + selection (document node ids), and the
 * no-paywall-open degradation. The vocabulary is document-first — edits are live
 * `edit_document` ops, not a `paywall.tsx` fork/apply.
 */
describe("designerSystemPrompt", () => {
  const base = designerSystemPrompt();

  it("returns the base prompt unchanged when no context is supplied", () => {
    expect(base).toContain("You are Voidhash AI");
    expect(base).not.toContain("Current context:");
    expect(systemPromptForSurface("designer")).toBe(base);
  });

  it("frames editing as live, undoable document transactions (no fork/apply)", () => {
    expect(base).toContain("edit_document");
    expect(base).toContain("live paywall");
    expect(base).toContain("UNDOABLE");
    // The old composition-as-a-file model is gone (no `paywall.tsx` grammar).
    expect(base).not.toContain("paywall.tsx");
    // The prompt explicitly negates the old apply step rather than describing one;
    // the only place `apply_changes` appears is that negation ("no apply_changes").
    expect(base).not.toContain("call `apply_changes`");
    expect(base).not.toContain("validate_changes");
  });

  it("carries the agentic How-to-work discipline in the base prompt", () => {
    expect(base).toContain("How to work:");
    expect(base).toContain("Keep going until the user's request is fully handled");
  });

  it("lists every paywall with its display name and code components", () => {
    const prompt = designerSystemPrompt({
      paywalls: [
        { slug: "trial", name: "Trial", componentFileNames: ["hero.tsx", "cta.tsx"] },
        { slug: "onboarding", name: "Onboarding", componentFileNames: [] },
      ],
      openPaywall: { slug: "trial", name: "Trial" },
      selectedNodeIds: [],
    });
    expect(prompt).toContain(
      '- trial ("Trial"): components: components/hero.tsx, components/cta.tsx',
    );
    expect(prompt).toContain('- onboarding ("Onboarding"): no code components');
  });

  it("names the open paywall and points at edit_document for unqualified refs", () => {
    const prompt = designerSystemPrompt({
      paywalls: [{ slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { slug: "trial", name: "Trial" },
      selectedNodeIds: [],
    });
    expect(prompt).toContain('has the "Trial" paywall (slug "trial") open');
    expect(prompt).toContain("edit_document");
    expect(prompt).toContain('"this paywall"');
    // No workspace path for the open paywall in the document-first model.
    expect(prompt).not.toContain("/paywalls/trial/paywall.tsx");
  });

  it("renders the selection as directly-addressable document node ids (plural)", () => {
    const prompt = designerSystemPrompt({
      paywalls: [{ slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { slug: "trial", name: "Trial" },
      selectedNodeIds: ["node_a", "node_b"],
    });
    expect(prompt).toContain("nodes with id node_a, node_b selected");
    expect(prompt).toContain("edit_document");
  });

  it("uses the singular for a single selected node", () => {
    const prompt = designerSystemPrompt({
      paywalls: [{ slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { slug: "trial", name: "Trial" },
      selectedNodeIds: ["node_a"],
    });
    expect(prompt).toContain("node with id node_a selected");
  });

  it("states no paywall is open when none matches", () => {
    const prompt = designerSystemPrompt({
      paywalls: [{ slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: undefined,
      selectedNodeIds: [],
    });
    expect(prompt).toContain("does not have a specific paywall open");
  });
});
