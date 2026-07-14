import { z } from "zod";

/**
 * A studio surface the Voidhash AI agent can be embedded on. Each surface maps
 * to its own system prompt and client-executed tool set.
 */
export type Surface = "designer";

// ---------------------------------------------------------------------------
// Document edit vocabulary (edit_document)
// ---------------------------------------------------------------------------

/**
 * A node to insert, as authored by the model. IMPORTANT: this schema is
 * deliberately STRUCTURALLY LOOSE — it does NOT re-declare the style vocabulary
 * or per-type data fields in zod. Hand-mirroring the mimic style/data schema into
 * zod would recreate the three-way drift (compose grammar / zod / mimic) that the
 * document-first authoring redesign exists to kill. The real gate is the
 * schema-derived validator (`validateDocumentEdits`), which reads the live mimic
 * node schemas and produces field-level errors naming allowed fields/values.
 *
 * Fields:
 * - `type` — the node type to create (`view`, `scrollView`, `text`, `shape`,
 *   `path`, `component`; `screen` at the top level). `root`, `library`,
 *   `codeComponent` are NOT insertable here.
 * - `name` — optional display name.
 * - node data fields — spread at the top level: `style` (a `{ field: value }`
 *   object), `text` (for text nodes), component identity fields, etc. Validated
 *   against the node type's schema by the executor.
 * - `children` — optional nested subtree.
 * Engine mints all ids; do not supply them.
 */
export interface NodeInput {
  type: string;
  name?: string;
  children?: NodeInput[];
  [dataField: string]: unknown;
}

/** Zod schema for {@link NodeInput} — loose by design (see the interface docs). */
export const nodeInputSchema: z.ZodType<NodeInput> = z.lazy(() =>
  z
    .object({
      type: z
        .string()
        .describe(
          "Node type to create: `view` (a flex container / row / column), `scrollView` (a scrollable container), `text`, `shape`, `path`, or `component`. `screen` only at the paywall top level. Ids are engine-minted — never supply one.",
        ),
      name: z.string().optional().describe("Optional display name for the node."),
      style: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Style fields as a flat `{ field: value }` object (e.g. `{ backgroundColor: 'rgba(0,0,0,1)', paddingTop: 16 }`). Allowed fields and value types depend on the node type and are validated on apply — an invalid field/value returns an error naming the allowed fields/values. Setting any background/border/shadow (or path fill/stroke) style field automatically sets the group's `*Enabled` flag to true; set it to `false` explicitly to hide the group non-destructively.",
        ),
      children: z.array(nodeInputSchema).optional().describe("Nested child nodes, in order."),
    })
    .passthrough(),
);

/**
 * One atomic document edit. `edit_document` applies a batch of these
 * all-or-nothing. Nodes are addressed by their mimic id (from get_document or the
 * current selection); ids for inserted nodes are engine-minted and RETURNED.
 */
export const documentEditSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("insert"),
      parentId: z
        .string()
        .describe("Id of the node to insert under. Must legally contain the inserted node type."),
      index: z
        .number()
        .int()
        .optional()
        .describe(
          "0-based position among the parent's children. Omitted or past the end appends; out-of-range indices are clamped.",
        ),
      node: nodeInputSchema.describe("The subtree to insert. Ids are engine-minted and returned."),
    })
    .describe(
      "Insert a new subtree under `parentId` at `index`. Engine mints every node id and returns them (keyed by insertion order) so you can address the new nodes in follow-up edits.",
    ),
  z
    .object({
      op: z.literal("update"),
      nodeId: z.string().describe("Id of the node to update."),
      set: z
        .record(z.string(), z.unknown())
        .describe(
          "Partial node data to merge. MERGE SEMANTICS: objects (e.g. `style`) merge per-field — unspecified fields are untouched; arrays and scalars REPLACE wholesale. To change one style field, send `set: { style: { paddingTop: 8 } }`. Invalid fields/values return errors naming the allowed fields/values. Setting any background/border/shadow (or path fill/stroke) style field automatically sets the group's `*Enabled` flag to true; set it to `false` explicitly to hide the group non-destructively.",
        ),
    })
    .describe(
      "Partially update a node's data. `set.style` merges per style field; other objects merge per-field; arrays and scalars replace. Only the fields you include change.",
    ),
  z
    .object({
      op: z.literal("move"),
      nodeId: z.string().describe("Id of the node to move."),
      parentId: z
        .string()
        .describe(
          "Id of the new parent. Must legally contain the moved node type; may not be the node itself or a descendant (no cycles).",
        ),
      index: z
        .number()
        .int()
        .describe("0-based position among the new parent's children (clamped into range)."),
    })
    .describe(
      "Reparent a node to `parentId` at `index`. Rejected if it would create a cycle or the target cannot contain the node type.",
    ),
  z
    .object({
      op: z.literal("remove"),
      nodeId: z.string().describe("Id of the node (and its subtree) to remove."),
    })
    .describe("Remove a node and its entire subtree."),
  z
    .object({
      op: z.literal("replaceChildren"),
      nodeId: z.string().describe("Id of the node whose children are replaced."),
      children: z
        .array(nodeInputSchema)
        .describe("The new, complete ordered child list. All ids are engine-minted and returned."),
    })
    .describe(
      "Replace ALL children of `nodeId` with a new ordered list (the old subtree is removed). Engine mints and returns the new ids.",
    ),
]);

/** A single document edit op (discriminated on `op`). */
export type DocumentEdit = z.infer<typeof documentEditSchema>;

// ---------------------------------------------------------------------------
// Designer tool input schemas
// ---------------------------------------------------------------------------

/**
 * Input schemas for the designer-surface tools. Declared here (shared package)
 * so the server-side tool DECLARATIONS (schema-only, no `execute`) and the
 * browser EXECUTOR (apps/www) validate against ONE definition and cannot drift.
 *
 * The designer tools are CLIENT-EXECUTED: the model calls them, the AI SDK ends
 * the request, and the browser runs each tool against the **currently open
 * paywall document** before auto-continuing the chat. Composition is authored as
 * MIMIC DOCUMENT EDITS (`edit_document`) — there is no `paywall.tsx` and no
 * fork/apply step; edits are validated and applied incrementally. Code components
 * remain code-authored and are managed by the `*_component` tools. `read_paywall`
 * is the only cross-paywall (read-only) tool.
 */
export const designerToolSchemas = {
  // -- read --
  get_document: z.object({
    nodeId: z
      .string()
      .optional()
      .describe(
        "Optional node id to root the returned tree at (defaults to the whole document). Use to zoom into a subtree.",
      ),
    depth: z
      .number()
      .int()
      .optional()
      .describe(
        "Optional max depth from the root. Nodes past the limit render as stubs `{ id, type, name?, childCount }` you can expand with a follow-up get_document(nodeId).",
      ),
  }),
  get_rendered_layout: z.object({
    nodeIds: z
      .array(z.string())
      .max(100)
      .optional()
      .describe(
        "Optional document node ids to inspect. Omit to inspect every rendered node in the open paywall (capped at 100). Returns actual browser geometry, resolved typography/overflow styles, and clipping signals.",
      ),
  }),
  get_preview_screenshot: z.object({
    nodeId: z
      .string()
      .optional()
      .describe(
        "Optional document node id to capture. Defaults to the paywall screen. Capture a subtree only when you need a closer review.",
      ),
    scale: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe("Raster scale. Use 1 for layout review and 2 only for small text or fine details."),
  }),
  get_components: z.object({}),
  read_component: z.object({
    path: z
      .string()
      .describe(
        "Canonical document-relative path of a LOCAL component to read (`components/<name>.tsx`).",
      ),
  }),
  read_paywall: z.object({
    slug: z
      .string()
      .describe(
        "Slug of ANY paywall in the project whose document JSON to read for reference (read-only — you can only EDIT the currently open paywall).",
      ),
  }),
  // -- write --
  edit_document: z.object({
    edits: z
      .array(documentEditSchema)
      .min(1)
      .describe(
        "Ordered batch of document edits, applied ATOMICALLY (all-or-nothing). Returns minted ids for inserts, or per-edit structured errors naming the offending node/field/value.",
      ),
  }),
  duplicate_subtree: z.object({
    nodeId: z.string().describe("Id of the existing visual node subtree to duplicate."),
    parentId: z
      .string()
      .describe("Id of the destination parent. It must legally contain the duplicated node type."),
    index: z
      .number()
      .int()
      .optional()
      .describe("Optional 0-based destination index. Omit to append."),
    name: z
      .string()
      .optional()
      .describe("Optional display name override for the duplicated subtree root."),
  }),
  write_component: z.object({
    path: z
      .string()
      .describe(
        "Canonical document-relative path (`components/<name>.tsx`). Writing a path that does not exist yet CREATES the component (its path IS its identity).",
      ),
    source: z.string().describe("Full TSX component source."),
  }),
  rename_component: z.object({
    fromPath: z.string().describe("Existing component path (`components/<name>.tsx`)."),
    toPath: z
      .string()
      .describe(
        "New component path. Instances referencing the old path are re-pointed automatically.",
      ),
  }),
  delete_component: z.object({
    path: z.string().describe("Component path to delete (`components/<name>.tsx`)."),
  }),
  finish_design: z.object({
    reviewedDocumentSignature: z
      .string()
      .describe(
        "The exact document signature returned by the final get_preview_screenshot call. Completion is rejected if the document changed after that review.",
      ),
    verdict: z
      .string()
      .min(1)
      .max(1000)
      .describe(
        "Concise visual QA verdict covering hierarchy, spacing, typography/contrast, alignment, clipping/safe areas, and purchase affordances.",
      ),
    unresolvedIssues: z
      .array(z.string())
      .max(20)
      .describe(
        "Issues still visible in the reviewed screenshot. This must be empty to finish; otherwise correct them and review again.",
      ),
  }),
} as const;

export type DesignerToolName = keyof typeof designerToolSchemas;

/**
 * Model-facing descriptions for each designer tool. These are the model's ONLY
 * documentation for the document-first authoring model, so they are precise about
 * node addressing (ids from get_document / selection), the `edit_document` op
 * semantics + merge rules + minted-id returns, and that field-level validation
 * errors will name the allowed fields/values.
 */
export const designerToolDescriptions: Record<DesignerToolName, string> = {
  get_document:
    "Return the open paywall's document as cleaned JSON: a nested tree of `{ id, type, name?, ...data, children }` nodes with schema-default fields stripped. Every node has a stable `id` you address in edit_document. Pass `nodeId` to root at a subtree and `depth` to cap the tree (deeper nodes come back as stubs you can expand). `codeComponent` definitions come back with their `path` and a `sourceLength` only — the TSX source is NOT inlined; read it with read_component. Call this before editing to learn the current structure and ids.",
  get_rendered_layout:
    "Inspect the ACTUAL browser-rendered layout of document nodes, not just their declared style data. Returns geometry relative to the screen, resolved overflow/typography styles, scroll dimensions, and clipping signals. Call this when spacing, alignment, overflow, safe-area fit, or above-the-fold placement needs exact measurements. Omit nodeIds to inspect the rendered paywall, or pass a focused set after a screenshot identifies a problem.",
  get_preview_screenshot:
    "Capture the current live paywall canvas as a PNG and return it as multimodal tool content for visual review. Defaults to the screen at 1x. Call after every meaningful visual section and ALWAYS after the final edit. Evaluate hierarchy, CTA dominance, spacing, typography, contrast, alignment, clipping, safe areas, product-option states, and close/restore/legal affordances; make targeted corrections before finishing. The result includes a document signature required by finish_design.",
  get_components:
    'List every component available to place: CATALOG components (deployed, shared), LOCAL code components (defined in this paywall), AND first-party BUILTINS that ship with the renderer. Each entry carries its path/slug, description, props schema, action list, and preview states — everything you need to insert a `component` node and bind its props/actions correctly. Insert a catalog component with its `componentSlug`; a local one with `componentPath` + `componentSource: "local"`; a builtin with `componentSource: "builtin"` + its `componentSlug` (builtins are UNPINNED — no version/hash).',
  read_component:
    "Read a LOCAL code component's TSX source by its `components/<name>.tsx` path, reflecting your in-progress edits. Use get_components first to discover paths; use read_paywall to read a DIFFERENT paywall.",
  read_paywall:
    "Read ANOTHER paywall's document JSON by slug for reference (e.g. to match its design). Read-only — you can only EDIT the currently open paywall.",
  edit_document:
    "Apply an ATOMIC batch of edits to the open paywall document (all-or-nothing). Ops: `insert` (add a subtree under a parent at an index — ids are engine-minted and RETURNED so you can address the new nodes next), `update` (partial data change; `set.style` merges per style field, other objects merge per-field, arrays/scalars replace wholesale), `move` (reparent; cycles and illegal containment are rejected), `remove` (delete a subtree), `replaceChildren` (swap a node's whole child list). Address nodes by the ids from get_document or the current selection. Invalid fields/values are rejected with per-edit errors naming the offending node, the allowed fields (with a did-you-mean), and the allowed values — read them and correct your edit.",
  duplicate_subtree:
    "Deep-clone an existing visual document subtree under a destination parent. The clone preserves node data, styles, interactions, and descendants while the engine mints fresh node ids, which are returned for follow-up edits. Prefer this for repeated product rows, benefits, cards, and controls so spacing and structure remain consistent. Engine-managed root/library/codeComponent nodes cannot be duplicated.",
  write_component:
    "Create-or-replace a LOCAL code component at `components/<name>.tsx` (its path is its identity). On success the component is compiled and committed and becomes placeable via a `component` node; on failure you get compile diagnostics. Use for anything that is genuinely code (custom logic/layout), not for plain composition — compose visual structure with edit_document.",
  rename_component:
    "Rename a local component from one `components/<name>.tsx` path to another. Instances referencing the old path are re-pointed automatically (rename cascade).",
  delete_component:
    "Delete a local component by path. Existing instances of it degrade to placeholders (they are not cascade-deleted), so replace or remove them afterward.",
  finish_design:
    "Complete the visual editing task only after a final get_preview_screenshot. Pass its exact document signature, a concise visual QA verdict, and an empty unresolvedIssues list. The call is rejected if the document changed after the screenshot or if issues remain, forcing another correction-and-review cycle instead of ending on an unverified tree.",
};

/** Multimodal output produced by `get_preview_screenshot`. */
export const previewScreenshotToolOutputSchema = z.object({
  kind: z.literal("preview-screenshot"),
  mediaType: z.literal("image/png"),
  dataBase64: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scale: z.union([z.literal(1), z.literal(2)]),
  documentSignature: z.string(),
  message: z.string(),
});

export type PreviewScreenshotToolOutput = z.infer<typeof previewScreenshotToolOutputSchema>;

/** Successful screenshot payload or the executor's recoverable text error. */
export const previewScreenshotToolResultSchema = z.union([
  previewScreenshotToolOutputSchema,
  z.string(),
]);

/** Model/client output schema for every designer tool. */
export const designerToolOutputSchemas: Record<DesignerToolName, z.ZodTypeAny> = {
  get_document: z.string(),
  get_rendered_layout: z.string(),
  get_preview_screenshot: previewScreenshotToolResultSchema,
  get_components: z.string(),
  read_component: z.string(),
  read_paywall: z.string(),
  edit_document: z.string(),
  duplicate_subtree: z.string(),
  write_component: z.string(),
  rename_component: z.string(),
  delete_component: z.string(),
  finish_design: z.string(),
};

/** Tool input schemas for a surface. */
export const toolSchemasForSurface = (surface: Surface) =>
  ({ designer: designerToolSchemas })[surface];

// ---------------------------------------------------------------------------
// Tool result wire shapes (executors return these; www + backend agree on them)
// ---------------------------------------------------------------------------

/**
 * A per-edit failure returned by `edit_document`, mirroring the validator's
 * {@link DocumentEditError} on the wire. `editIndex` locates the offending op in
 * the submitted batch; `message` is the self-contained, model-facing text.
 */
export const documentEditErrorSchema = z.object({
  editIndex: z.number().int(),
  code: z.enum([
    "unknownNode",
    "unknownParent",
    "illegalChild",
    "moveCycle",
    "invalidNodeType",
    "unknownField",
    "invalidValue",
    "indexOutOfBounds",
    "emptyBatch",
    "protectedTarget",
    "overlappingEdits",
    "missingComponentIdentity",
  ]),
  nodeId: z.string().optional(),
  field: z.string().optional(),
  message: z.string(),
});

export type DocumentEditErrorResult = z.infer<typeof documentEditErrorSchema>;

/**
 * The minted ids `edit_document` returns for each `insert` / `replaceChildren`
 * op, keyed by the op's index in the submitted batch. Each entry is the ordered
 * list of ids minted for the nodes that op created (parents before children,
 * pre-order), so the model can address freshly-inserted nodes in a follow-up.
 */
export const mintedIdsSchema = z.record(z.string(), z.array(z.string()));

export type MintedIds = z.infer<typeof mintedIdsSchema>;

/**
 * The structured result of an `edit_document` call: on success the minted-id map;
 * on failure the collected per-edit errors (the whole batch is rejected — nothing
 * is applied).
 *
 * This is the DESIGNER-surface wire contract: the browser executor builds its
 * `edit_document` tool output by parsing through this schema before stringifying,
 * so the JSON the model reads can never drift from this type. The MCP surface
 * deliberately does NOT use it — it renders the same outcome as PROSE for the
 * model (minted ids / errors described in text), so its tool output is not this
 * shape.
 */
export const editDocumentResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), mintedIds: mintedIdsSchema }),
  z.object({ ok: z.literal(false), errors: z.array(documentEditErrorSchema) }),
]);

export type EditDocumentResult = z.infer<typeof editDocumentResultSchema>;
