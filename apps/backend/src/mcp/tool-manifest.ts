/**
 * The MCP tool manifest: the JSON-Schema-described tools advertised over
 * `tools/list` and dispatched over `tools/call`, plus the mapping from a tool
 * name to the stateless workspace-tool core ({@link WorkspaceTools}).
 *
 * MCP is STATELESS and DOCUMENT-FIRST now — there is no fork, no `paywall.tsx`,
 * no whole-target overwrite. Composition is read as cleaned document JSON and
 * edited with mimic DOCUMENT ops (`edit_paywall`); code components are read and
 * managed by their canonical `components/<name>.tsx` path. The tool set:
 * `list_paywalls`, `get_paywall`, `get_components`, `read_component`,
 * `edit_paywall`, `write_component`, `rename_component`, `delete_component`.
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
 * MCP tool input schemas. These are MCP-specific but share the document-edit
 * vocabulary (`documentEditSchema`) with the browser designer tools in
 * `ai-shared`, so a batch validates against ONE definition on both surfaces.
 */
const mcpToolSchemas = {
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
    edits: z
      .array(documentEditSchema)
      .min(1)
      .describe(
        "Ordered batch of document edits, applied ATOMICALLY (all-or-nothing) against the LIVE document. Returns minted ids for inserts, or per-edit structured errors naming the offending node/field/value. Setting any background/border/shadow (or path fill/stroke) style field automatically sets the group's `*Enabled` flag to true; set it to `false` explicitly to hide the group non-destructively.",
      ),
  }),
  write_component: z.object({
    slug: z.string().describe("Slug of the paywall to write the component into."),
    path: z
      .string()
      .describe(
        "Canonical document-relative path (`components/<name>.tsx`). Writing a path that does not exist yet CREATES the component (its path IS its identity).",
      ),
    source: z.string().describe("Full TSX component source."),
  }),
  rename_component: z.object({
    slug: z.string().describe("Slug of the paywall the component belongs to."),
    fromPath: z.string().describe("Existing component path (`components/<name>.tsx`)."),
    toPath: z
      .string()
      .describe("New component path. Instances referencing the old path are re-pointed automatically."),
  }),
  delete_component: z.object({
    slug: z.string().describe("Slug of the paywall the component belongs to."),
    path: z.string().describe("Component path to delete (`components/<name>.tsx`)."),
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
    "get_paywall",
    "Read a paywall's LIVE document as cleaned JSON: a nested tree of `{ id, type, name?, ...data, children }` nodes with schema-default fields stripped. Every node has a stable `id` you address in edit_paywall. Pass `nodeId` to root at a subtree and `depth` to cap the tree (deeper nodes come back as stubs you can expand). `codeComponent` definitions come back with their `path` and a `sourceLength` only — the TSX source is NOT inlined; read it with read_component. Call this before editing to learn the current structure and ids.",
    mcpToolSchemas.get_paywall,
    WorkspaceTools.getPaywall,
  ),
  validatedTool(
    "get_components",
    "List every component you can place in a paywall: CATALOG components (deployed, shared across the project) AND the paywall's LOCAL code components. Each entry carries its slug/path, version, and manifest (props schema, action list, preview states) — everything you need to insert a `component` node and bind its props/actions. A local component with no compiled manifest yet is listed with a note; read_component to see its source.",
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
];

/** The advertised tool descriptors for `tools/list`. */
export const mcpToolDescriptors = (): ReadonlyArray<McpToolDescriptor> =>
  MCP_TOOLS.map((tool) => tool.descriptor);

/** Look up a tool by name for `tools/call`; `undefined` for an unknown tool. */
export const findMcpTool = (name: string): McpTool | undefined =>
  MCP_TOOLS.find((tool) => tool.descriptor.name === name);
