/**
 * The MCP tool manifest: the JSON-Schema-described tools advertised over
 * `tools/list` and dispatched over `tools/call`, plus the mapping from a tool
 * name to the stateless workspace-tool core ({@link WorkspaceTools}).
 *
 * MCP is STATELESS and DOCUMENT-FIRST now — there is no fork, no `paywall.tsx`,
 * no whole-target overwrite. Composition is read as cleaned document JSON and
 * edited with mimic DOCUMENT ops (`edit_paywall`); code components are read and
 * managed by their canonical `components/<name>.tsx` path. Explicit change sets
 * wrap all mutations, subtree duplication is first-class, and finishing is
 * gated on inspecting a version-bound PNG preview.
 *
 * **Schema alignment**: each validated tool's `inputSchema` is derived at module
 * load from the SAME zod schema its dispatcher parses with, via `z.toJSONSchema`
 * (zod 4, native). Deriving — rather than hand-writing — means the JSON Schema an
 * MCP client validates against can never drift from the zod schema the executor
 * parses with; the contract test (`mcp/tool-manifest.test.ts`) round-trips valid
 * + invalid samples through both to prove structural agreement.
 */
import { documentEditSchema } from "@voidhash/ai-shared";
import { Effect } from "effect";
import { z } from "zod";

import * as WorkspaceTools from "../ai/workspace-tools.ts";

/** A JSON Schema object (the `inputSchema` advertised for a tool). */
export type JsonSchema = Record<string, unknown>;

/** The description of one advertised MCP tool. */
export interface McpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

/**
 * One MCP tool: its advertised descriptor + a dispatcher that validates the raw
 * arguments with the aligned zod schema and runs the stateless workspace-tool
 * core. `dispatch` never fails (`E = never`) — the core folds workspace failures
 * into a `{ isError: true }` result; an invalid-arguments failure is likewise
 * folded into a tool result (MCP maps a bad-input tool call to `isError`, not a
 * JSON-RPC error).
 */
export interface McpTool {
  readonly descriptor: McpToolDescriptor;
  readonly dispatch: (
    scope: WorkspaceTools.WorkspaceToolScope,
    args: unknown,
  ) => Effect.Effect<WorkspaceTools.WorkspaceToolResult, never, WorkspaceTools.WorkspaceToolDeps>;
}

/** JSON Schema for a tool with no input (`list_paywalls`). */
const EMPTY_INPUT_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {},
  additionalProperties: false,
};

/**
 * MCP tool input schemas. The internal Pi agent consumes this same manifest,
 * and `documentEditSchema` remains the single validation vocabulary for every
 * server-executed document batch.
 */
const mcpToolSchemas = {
  begin_paywall_edit: z.object({
    slug: z.string().describe("Slug of the paywall to edit."),
  }),
  get_paywall: z.object({
    slug: z.string().describe("Slug of the paywall to read (from list_paywalls)."),
    nodeId: z
      .string()
      .optional()
      .describe(
        "Optional node id to root the returned tree at (defaults to the whole document). Use to zoom into a subtree; ids come from a prior get_paywall.",
      ),
    depth: z
      .number()
      .int()
      .optional()
      .describe(
        "Optional max depth from the root. Nodes past the limit render as stubs `{ id, type, name?, childCount }` you expand with a follow-up get_paywall(nodeId).",
      ),
  }),
  get_components: z.object({
    slug: z.string().describe("Slug of the paywall whose placeable components to list."),
  }),
  read_component: z.object({
    slug: z.string().describe("Slug of the paywall the component belongs to."),
    path: z
      .string()
      .describe("Canonical document-relative path of a LOCAL component (`components/<name>.tsx`)."),
  }),
  edit_paywall: z.object({
    slug: z.string().describe("Slug of the paywall to edit."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    edits: z
      .array(documentEditSchema)
      .min(1)
      .describe(
        "Ordered batch of document edits, applied ATOMICALLY (all-or-nothing) against the LIVE document. Returns minted ids for inserts, or per-edit structured errors naming the offending node/field/value. Setting any background/border/shadow (or path fill/stroke) style field automatically sets the group's `*Enabled` flag to true; set it to `false` explicitly to hide the group non-destructively.",
      ),
  }),
  duplicate_subtree: z.object({
    slug: z.string().describe("Slug of the paywall to edit."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    nodeId: z.string().describe("Id of the visual subtree to clone."),
    parentId: z.string().describe("Id of the destination parent."),
    index: z.number().int().optional().describe("Optional destination child index."),
    nextName: z.string().optional().describe("Optional display name for the cloned root."),
  }),
  write_component: z.object({
    slug: z.string().describe("Slug of the paywall to write the component into."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    path: z
      .string()
      .describe(
        "Canonical document-relative path (`components/<name>.tsx`). Writing a path that does not exist yet CREATES the component (its path IS its identity).",
      ),
    source: z.string().describe("Full TSX component source."),
  }),
  rename_component: z.object({
    slug: z.string().describe("Slug of the paywall the component belongs to."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    fromPath: z.string().describe("Existing component path (`components/<name>.tsx`)."),
    toPath: z
      .string()
      .describe(
        "New component path. Instances referencing the old path are re-pointed automatically.",
      ),
  }),
  delete_component: z.object({
    slug: z.string().describe("Slug of the paywall the component belongs to."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    path: z.string().describe("Component path to delete (`components/<name>.tsx`)."),
  }),
  get_paywall_preview: z.object({
    slug: z.string().describe("Slug of the paywall to render."),
    changeSetId: z
      .string()
      .describe("Active change-set id returned by begin_paywall_edit for this paywall."),
    width: z
      .number()
      .int()
      .min(240)
      .max(1440)
      .optional()
      .describe("Viewport width; defaults to 375."),
    height: z
      .number()
      .int()
      .min(240)
      .max(1600)
      .optional()
      .describe("Viewport height; defaults to 812."),
    scale: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe("Device scale; defaults to 1."),
  }),
  finish_paywall_edit: z.object({
    slug: z.string().describe("Slug of the paywall whose edit session should finish."),
    changeSetId: z.string().describe("Active change-set id to finish."),
    reviewedDocumentSignature: z
      .string()
      .describe("Exact documentSignature from the latest get_paywall_preview result."),
    verdict: z.string().min(1).describe("Concise visual QA verdict based on the preview image."),
    unresolvedIssues: z
      .array(z.string())
      .default([])
      .describe("Any remaining visual issues. Must be empty to finish."),
  }),
  revert_paywall_edit: z.object({
    changeSetId: z.string().describe("Change-set id whose complete edits should be reverted."),
  }),
} as const;

/**
 * Build a tool that validates its arguments with `schema`, then runs `run` with
 * the parsed input. A zod parse failure is folded into an `isError` tool result
 * (never a JSON-RPC error), matching the shared core's fold-don't-throw contract.
 */
const validatedTool = <Input>(
  name: string,
  description: string,
  schema: z.ZodType<Input>,
  run: (
    scope: WorkspaceTools.WorkspaceToolScope,
    input: Input,
  ) => Effect.Effect<WorkspaceTools.WorkspaceToolResult, never, WorkspaceTools.WorkspaceToolDeps>,
): McpTool => ({
  descriptor: {
    name,
    description,
    inputSchema: z.toJSONSchema(schema) as JsonSchema,
  },
  dispatch: (scope, args) => {
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return Effect.succeed({
        output: `${name}: invalid arguments — ${issues}`,
        isError: true,
      });
    }
    return run(scope, parsed.data);
  },
});

/**
 * The MCP tools, in advertised order: discovery (`list_paywalls`), read
 * (`get_paywall` / `get_components` / `read_component`), then the write surface
 * (`edit_paywall` for composition, `write_component` / `rename_component` /
 * `delete_component` for code components).
 */
export const MCP_TOOLS: ReadonlyArray<McpTool> = [
  {
    descriptor: {
      name: "list_paywalls",
      description:
        "List every paywall in the project as a directory (slug + workspace path). Start here to discover what to read or edit; then use get_paywall to read a paywall's document and get_components to see what you can place.",
      inputSchema: EMPTY_INPUT_SCHEMA,
    },
    dispatch: (scope) => WorkspaceTools.listPaywalls(scope),
  },
  validatedTool(
    "begin_paywall_edit",
    "Begin an explicit edit session for one paywall. This captures a revert baseline and returns the changeSetId required by every mutation. Only one active change set is allowed per paywall; finish or revert it before starting another.",
    mcpToolSchemas.begin_paywall_edit,
    WorkspaceTools.beginPaywallEdit,
  ),
  validatedTool(
    "get_paywall",
    "Read a paywall's LIVE document as cleaned JSON: a nested tree of `{ id, type, name?, ...data, children }` nodes with schema-default fields stripped. Every node has a stable `id` you address in edit_paywall. Pass `nodeId` to root at a subtree and `depth` to cap the tree (deeper nodes come back as stubs you can expand). `codeComponent` definitions come back with their `path` and a `sourceLength` only — the TSX source is NOT inlined; read it with read_component. Call this before editing to learn the current structure and ids.",
    mcpToolSchemas.get_paywall,
    WorkspaceTools.getPaywall,
  ),
  validatedTool(
    "get_components",
    "List every component you can place in a paywall: CATALOG components (deployed, shared across the project), the paywall's LOCAL code components, and BUILTIN primitives. Entries carry their slug/path and authoring contract (props, actions, preview states) plus the insertion identity. A local component with no compiled manifest yet is listed with a note; read_component to see its source.",
    mcpToolSchemas.get_components,
    WorkspaceTools.getComponents,
  ),
  validatedTool(
    "read_component",
    "Read a LOCAL code component's TSX source by its `components/<name>.tsx` path. Use get_components first to discover paths.",
    mcpToolSchemas.read_component,
    WorkspaceTools.readComponent,
  ),
  validatedTool(
    "edit_paywall",
    "Apply an ATOMIC batch of edits to a paywall's LIVE document (all-or-nothing). Ops: `insert` (add a subtree under a parent at an index — ids are engine-minted and RETURNED so you can address the new nodes next), `update` (partial data change; `set.style` merges per style field, other objects merge per-field, arrays/scalars replace wholesale), `move` (reparent; cycles and illegal containment are rejected), `remove` (delete a subtree), `replaceChildren` (swap a node's whole child list). Address nodes by the ids from get_paywall. Setting any background/border/shadow (or path fill/stroke) style field automatically sets the group's `*Enabled` flag to true; set it to `false` explicitly to hide the group non-destructively. Invalid fields/values are rejected with per-edit errors naming the offending node, the allowed fields (with a did-you-mean), and the allowed values — read them and correct your edit, then retry. On success the minted ids are returned keyed by op index.",
    mcpToolSchemas.edit_paywall,
    WorkspaceTools.editPaywall,
  ),
  validatedTool(
    "duplicate_subtree",
    "Duplicate an existing visual subtree under a destination parent. Engine-managed root/library/codeComponent nodes cannot be cloned. All cloned ids are freshly minted and returned by the underlying atomic edit.",
    mcpToolSchemas.duplicate_subtree,
    WorkspaceTools.duplicateSubtree,
  ),
  validatedTool(
    "write_component",
    "Create-or-replace a LOCAL code component at `components/<name>.tsx` (its path is its identity). The source is COMPILED server-side first: on compile/runtime diagnostics nothing is committed and the diagnostics are returned — fix them and retry. On success the component is committed and becomes placeable via a `component` node (insert one with edit_paywall). Use for anything that is genuinely code (custom logic/layout), not for plain composition — compose visual structure with edit_paywall.",
    mcpToolSchemas.write_component,
    WorkspaceTools.writeComponent,
  ),
  validatedTool(
    "rename_component",
    "Rename a local component from one `components/<name>.tsx` path to another. Instances referencing the old path are re-pointed automatically (rename cascade).",
    mcpToolSchemas.rename_component,
    WorkspaceTools.renameComponent,
  ),
  validatedTool(
    "delete_component",
    "Delete a local component by path. Existing instances of it degrade to placeholders (they are not cascade-deleted), so replace or remove them with edit_paywall afterward.",
    mcpToolSchemas.delete_component,
    WorkspaceTools.deleteComponent,
  ),
  validatedTool(
    "get_paywall_preview",
    "Render the current live paywall to a PNG and return it as MCP image content plus document version and signature. Visually inspect the image. A successful full preview is required before finish_paywall_edit, and any later document change invalidates it.",
    mcpToolSchemas.get_paywall_preview,
    WorkspaceTools.getPaywallPreview,
  ),
  validatedTool(
    "finish_paywall_edit",
    "Finish an active change set only after visual QA of its latest get_paywall_preview. Pass the exact document signature, a concise verdict, and an empty unresolvedIssues list. Stale or missing previews are rejected.",
    mcpToolSchemas.finish_paywall_edit,
    WorkspaceTools.finishPaywallEdit,
  ),
  validatedTool(
    "revert_paywall_edit",
    "Revert all edits in an active change set by reconciling the live paywall to the baseline captured by begin_paywall_edit, then mark the set reverted.",
    mcpToolSchemas.revert_paywall_edit,
    WorkspaceTools.revertPaywallEdit,
  ),
];

/** The advertised tool descriptors for `tools/list`. */
export const mcpToolDescriptors = (): ReadonlyArray<McpToolDescriptor> =>
  MCP_TOOLS.map((tool) => tool.descriptor);

/** Look up a tool by name for `tools/call`; `undefined` for an unknown tool. */
export const findMcpTool = (name: string): McpTool | undefined =>
  MCP_TOOLS.find((tool) => tool.descriptor.name === name);
