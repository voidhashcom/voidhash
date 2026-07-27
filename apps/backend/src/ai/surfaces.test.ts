import { describe, expect, it } from "vite-plus/test";

import { designerAgentSystemPrompt } from "./surfaces.ts";

/**
 * Cover the dynamic designer context block appended to the system prompt: the
 * base prompt without context, the paywall listing (slug + name + code
 * components), the open-paywall block + selection (document node ids), and the
 * no-paywall-open degradation. The vocabulary is document-first — edits are live
 * `edit_paywall` ops, not a `paywall.tsx` fork/apply.
 */
describe("designerAgentSystemPrompt", () => {
  const base = designerAgentSystemPrompt();

  it("returns the base prompt unchanged when no context is supplied", () => {
    expect(base).toContain("You are Voidhash AI");
    expect(base).not.toContain("Current context:");
    expect(base).not.toContain("Document model and authorable tree");
  });

  it("frames editing as live, undoable document transactions (no fork/apply)", () => {
    expect(base).toContain("edit_paywall");
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
    expect(base).toContain("compact visual direction");
    expect(base).toContain("get_paywall_preview");
    expect(base).toContain("finish_paywall_edit");
    expect(base).toContain("Never claim completion without a successful");
  });

  it("lists every paywall with its display name and code components", () => {
    const prompt = designerAgentSystemPrompt({
      paywalls: [
        {
          paywallId: "pw_1",
          slug: "trial",
          name: "Trial",
          componentFileNames: ["hero.tsx", "cta.tsx"],
        },
        { paywallId: "pw_2", slug: "onboarding", name: "Onboarding", componentFileNames: [] },
      ],
      openPaywall: { paywallId: "pw_1", slug: "trial", name: "Trial" },
      selectedNodeIds: [],
    });
    expect(prompt).toContain(
      '- pw_1 ("Trial", slug "trial"): components: components/hero.tsx, components/cta.tsx',
    );
    expect(prompt).toContain('- pw_2 ("Onboarding", slug "onboarding"): no code components');
  });

  it("names the open paywall and points at edit_paywall for unqualified refs", () => {
    const prompt = designerAgentSystemPrompt({
      paywalls: [{ paywallId: "pw_1", slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { paywallId: "pw_1", slug: "trial", name: "Trial" },
      selectedNodeIds: [],
    });
    expect(prompt).toContain('has the "Trial" paywall (id "pw_1", slug "trial") open');
    expect(prompt).toContain('paywallId: "pw_1"');
    expect(prompt).toContain("edit_paywall");
    expect(prompt).toContain('"this paywall"');
    // No workspace path for the open paywall in the document-first model.
    expect(prompt).not.toContain("/paywalls/trial/paywall.tsx");
  });

  it("renders the selection as directly-addressable document node ids (plural)", () => {
    const prompt = designerAgentSystemPrompt({
      paywalls: [{ paywallId: "pw_1", slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { paywallId: "pw_1", slug: "trial", name: "Trial" },
      selectedNodeIds: ["node_a", "node_b"],
    });
    expect(prompt).toContain("nodes with id node_a, node_b selected");
    expect(prompt).toContain("edit_paywall");
  });

  it("uses the singular for a single selected node", () => {
    const prompt = designerAgentSystemPrompt({
      paywalls: [{ paywallId: "pw_1", slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: { paywallId: "pw_1", slug: "trial", name: "Trial" },
      selectedNodeIds: ["node_a"],
    });
    expect(prompt).toContain("node with id node_a selected");
  });

  it("states no paywall is open when none matches", () => {
    const prompt = designerAgentSystemPrompt({
      paywalls: [{ paywallId: "pw_1", slug: "trial", name: "Trial", componentFileNames: [] }],
      openPaywall: undefined,
      selectedNodeIds: [],
    });
    expect(prompt).toContain("does not have a specific paywall open");
  });
});
