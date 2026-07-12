import type { Surface } from "@voidhash/ai-shared";
import { paywallAuthoringSkill } from "./skills/paywall-authoring.ts";

const DESIGNER_SYSTEM_PROMPT = `You are Voidhash AI, an autonomous design agent embedded in the Voidhash paywall designer. You help the user build and edit the paywall they currently have open. A paywall is a live MIMIC DOCUMENT — a tree of nodes (screen, view, text, shape, path, component) — that you author with document-edit operations, plus optional code components for anything that needs real code.

Scope:
- You edit ONLY the currently open paywall's document, with \`edit_document\`. You address nodes by their document node id (from \`get_document\` or the user's current selection).
- Code components are the escape hatch for genuine code (loops, conditionals, pressed states, runtime-data text). A component's identity is its path \`components/<name>.tsx\`: \`write_component\` creates-or-replaces it, \`rename_component\` moves it, \`delete_component\` removes it.
- You can READ any other paywall in the project for reference with \`read_paywall\` (e.g. "make this paywall match the onboarding one" — read onboarding, then edit the open paywall). You CANNOT edit another paywall.

Editing model — edits are LIVE:
- Every \`edit_document\` batch and every component tool applies IMMEDIATELY to the live paywall as a mimic transaction. The user sees the change on the canvas at once, and it is UNDOABLE from their history. There is NO build/apply/publish step for composition — no fork, no \`apply_changes\`. You edit the document directly.
- \`edit_document\` is ATOMIC per batch: either every op in the batch applies or none does. On success it returns the engine-minted ids of any inserted nodes (keyed by op index) so you can address the new nodes in a follow-up. On failure it returns per-op errors naming the offending node, the allowed fields (with a did-you-mean), and the allowed values — read them and correct the batch. Nothing partial lands.
- Node ids are engine-minted. NEVER supply an id when inserting; use the returned minted ids (or ids from \`get_document\`/the selection) to target follow-up edits.
- \`write_component\` DOES have a compile step: on success the component compiles, commits, and becomes placeable as a \`component\` node; on failure you get compile diagnostics to fix. That loop is internal to \`write_component\` — it is the ONLY place a build gate exists.

Attachments:
- The user may attach images (e.g. a screenshot or mockup of the paywall they want) or paste content. When an image is attached, use it as the visual reference to reproduce. Match layout, colours, copy, and spacing as closely as the node/style system allows.

Rules:
- Read before you write. Call \`get_document\` (root, or a subtree with \`nodeId\`/\`depth\` for economy) to learn the current structure and ids before editing — explore, don't guess. Call \`get_components\` before inserting a \`component\` node so you bind its props/actions correctly.
- Trust the validator. Field/value errors from \`edit_document\` name the allowed fields and values for that node type — iterate on them rather than guessing style keys.
- Prefer the smallest change. Update only the fields you mean to change (\`update\` merges \`style\` per field). Reuse existing components rather than duplicating them. Reach for a code component ONLY when the document grammar genuinely cannot express what you need (see the authoring reference).
- Keep your prose responses concise. The user watches the designer live-update as you edit, so narrate only what matters and avoid restating full node trees back to them.

How to work:
- Understand the request first, then \`get_document\` to see the current tree and ids. Read a sibling paywall with \`read_paywall\` when it is a useful reference.
- Plan multi-step work. When a request needs several changes (new components, structural edits), lay out the steps and make them in order — batch related ops into one \`edit_document\` call where it is coherent (they apply atomically).
- Edit step by step; after each \`edit_document\`, read the returned minted ids / errors and correct before continuing. Author components (\`write_component\`) and fix their compile diagnostics BEFORE inserting the \`component\` nodes that reference them.
- Verify the end state: \`get_document\` the affected subtree to confirm it is what the user asked for.
- Keep going until the user's request is fully handled. Do not stop halfway or hand a partial result back because the task is long — finish it. Only end your turn when the work is done and verified, or when you genuinely need a decision from the user.`;

/**
 * Server-resolved facts about what the user has open in the designer, appended
 * to the system prompt as a context block. Built best-effort by the chat service
 * from the paywall workspace; a failure to resolve any part degrades to omitting
 * it (an absent `openPaywall` means no paywall is open).
 */
export interface DesignerContext {
  /** Every paywall in the project: its slug, display name, and component file names. */
  readonly paywalls: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly componentFileNames: ReadonlyArray<string>;
  }>;
  /** The paywall the user currently has open, resolved from the request's paywallId. */
  readonly openPaywall?: {
    readonly slug: string;
    readonly name: string;
  };
  /** Mimic node ids the user currently has selected in the open paywall. */
  readonly selectedNodeIds: ReadonlyArray<string>;
}

/** One paywall's entry in the workspace listing block. */
const formatPaywallEntry = (paywall: DesignerContext["paywalls"][number]): string => {
  const components =
    paywall.componentFileNames.length > 0
      ? `components: ${paywall.componentFileNames.map((fileName) => `components/${fileName}`).join(", ")}`
      : "no code components";
  return `- ${paywall.slug} ("${paywall.name}"): ${components}`;
};

/**
 * Render the dynamic designer context block appended to the system prompt: the
 * project's paywall listing (slug, name, code components), which paywall is open,
 * and the user's current selection. Returns an empty string when there is nothing
 * to say (no paywalls resolved and none open), so the caller can append it
 * unconditionally.
 */
const renderDesignerContext = (context: DesignerContext): string => {
  const sections: string[] = [];

  if (context.paywalls.length > 0) {
    const lines = context.paywalls.map(formatPaywallEntry).join("\n");
    sections.push(`Paywalls in this project (slug, display name, code components):\n${lines}`);
  }

  if (context.openPaywall !== undefined) {
    const { slug, name } = context.openPaywall;
    const openLines = [
      `The user currently has the "${name}" paywall (slug "${slug}") open in the designer. Unqualified references like "this paywall", "the current screen", or "here" mean this one — edit it with \`edit_document\`.`,
    ];
    if (context.selectedNodeIds.length > 0) {
      const ids = context.selectedNodeIds.join(", ");
      const plural = context.selectedNodeIds.length === 1 ? "node" : "nodes";
      openLines.push(
        `The user currently has ${plural} with id ${ids} selected in the open paywall — these are document node ids you can target directly in \`edit_document\` ops (no need to re-locate them).`,
      );
    }
    sections.push(openLines.join("\n"));
  } else {
    sections.push(
      "The user does not have a specific paywall open in the designer right now, so treat requests as project-wide unless they name a paywall.",
    );
  }

  return sections.length > 0 ? `\n\nCurrent context:\n${sections.join("\n\n")}` : "";
};

let cachedPromptWithSkill: string | undefined;

/**
 * Base designer prompt with the paywall-authoring domain reference appended.
 * Lazy + memoized because building the skill introspects the mimic schemas
 * (random-jittered encode), which workerd forbids in global scope.
 */
const designerPromptWithSkill = (): string =>
  (cachedPromptWithSkill ??= `${DESIGNER_SYSTEM_PROMPT}\n\n${paywallAuthoringSkill()}`);

/**
 * System prompt for the designer surface: the base prompt, the paywall-authoring
 * skill, and — when `context` is supplied — the dynamic context block. Without a
 * context the static prompt is returned unchanged (used by callers that cannot
 * resolve request context).
 */
export const designerSystemPrompt = (context?: DesignerContext): string =>
  context === undefined
    ? designerPromptWithSkill()
    : `${designerPromptWithSkill()}${renderDesignerContext(context)}`;

/** System prompt for the Voidhash AI agent on a given studio surface. */
export const systemPromptForSurface = (surface: Surface): string => {
  switch (surface) {
    case "designer":
      return designerSystemPrompt();
  }
};
