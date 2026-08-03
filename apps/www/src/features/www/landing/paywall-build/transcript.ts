/**
 * One fragment of the Lenscal paywall, revealed when the `edit_paywall` call that
 * inserts it comes back. Ordered the way the agent builds the screen.
 */
export type PaywallPart =
  | "backdrop"
  | "statusBar"
  | "screenshot"
  | "foodCard"
  | "title"
  | "offer"
  | "toggle"
  | "cta"
  | "finePrint";

/** A single Voidhash MCP call as it appears in the agent transcript. */
export interface TranscriptStep {
  /** MCP tool name, as advertised by `apps/backend/src/mcp/tool-manifest.ts`. */
  readonly tool: string;
  /** Argument lines shown under the call header. */
  readonly args: readonly string[];
  /** The `⎿` result line shown once the call returns. */
  readonly result: string;
  /** Paywall fragments that appear on the canvas when this call returns. */
  readonly reveals?: readonly PaywallPart[];
  /** How long the call spends in flight before its result lands. */
  readonly runningMs: number;
}

export const AGENT_PROMPT =
  "Build the Lenscal Pro paywall: electric-blue hero, app shot with a scanned meal, 7-day free trial at $29.99/year.";

export const AGENT_INTRO = "I'll compose it on the live document, then preview before publishing.";

export const AGENT_OUTRO = "Lenscal Pro is live at 402×874 — trial toggle wired, pricing terms in place.";

export const TRANSCRIPT_STEPS: readonly TranscriptStep[] = [
  {
    args: [],
    result: "3 paywalls · lenscal-pro → pw_9f2a41",
    runningMs: 900,
    tool: "list_paywalls",
  },
  {
    args: ['paywallId: "pw_9f2a41"'],
    result: "editSessionId edit_7c31 · baseline v0",
    runningMs: 900,
    tool: "begin_paywall_edit",
  },
  {
    args: ['editSessionId: "edit_7c31"', "depth: 3"],
    result: 'screen "Paywall" 402×874 · 0 children',
    runningMs: 850,
    tool: "get_paywall",
  },
  {
    args: ['editSessionId: "edit_7c31"'],
    result: "9 builtin · 4 catalog · 0 local",
    runningMs: 850,
    tool: "get_components",
  },
  {
    args: ["insert · column + brand-blue backdrop, status bar"],
    result: "ok · 6 nodes minted · v1",
    reveals: ["backdrop", "statusBar"],
    runningMs: 1500,
    tool: "edit_paywall",
  },
  {
    args: ["insert · app screenshot in device frame"],
    result: "ok · 4 nodes minted · v2",
    reveals: ["screenshot"],
    runningMs: 1500,
    tool: "edit_paywall",
  },
  {
    args: ["insert · scanned-meal card"],
    result: "ok · 7 nodes minted · v3",
    reveals: ["foodCard"],
    runningMs: 1250,
    tool: "edit_paywall",
  },
  {
    args: ["insert · headline, offer copy"],
    result: "ok · 8 nodes minted · v4",
    reveals: ["title", "offer"],
    runningMs: 1400,
    tool: "edit_paywall",
  },
  {
    args: ['insert · reminder toggle, "Try It Free"'],
    result: "ok · 7 nodes minted · v5",
    reveals: ["toggle", "cta"],
    runningMs: 1400,
    tool: "edit_paywall",
  },
  {
    args: ["insert · pricing terms"],
    result: "ok · 5 nodes minted · v6",
    reveals: ["finePrint"],
    runningMs: 1200,
    tool: "edit_paywall",
  },
  {
    args: ['editSessionId: "edit_7c31"'],
    result: "PNG 402×874 · sig 4b91c0",
    runningMs: 1900,
    tool: "get_paywall_preview",
  },
  {
    args: ['verdict: "matches the brief"', "unresolvedIssues: []"],
    result: "session closed · published v6",
    runningMs: 1100,
    tool: "finish_paywall_edit",
  },
];
