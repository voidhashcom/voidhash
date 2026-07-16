import { z } from "zod";

// ---------------------------------------------------------------------------
// Document edit vocabulary (edit_paywall)
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
 *   against the node type's schema by the server-side workspace tool.
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
 * One atomic document edit. `edit_paywall` applies a batch of these
 * all-or-nothing. Nodes are addressed by their mimic id (from get_paywall or the
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

/**
 * A per-edit failure returned by `edit_paywall`, mirroring the validator's
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
 * The minted ids `edit_paywall` returns for each `insert` / `replaceChildren`
 * op, keyed by the op's index in the submitted batch. Each entry is the ordered
 * list of ids minted for the nodes that op created (parents before children,
 * pre-order), so the model can address freshly-inserted nodes in a follow-up.
 */
export const mintedIdsSchema = z.record(z.string(), z.array(z.string()));

export type MintedIds = z.infer<typeof mintedIdsSchema>;

/**
 * The structured result of an `edit_paywall` call: on success the minted-id map;
 * on failure the collected per-edit errors (the whole batch is rejected — nothing
 * is applied).
 *
 * Server-side workspace operations use this shape when applying edit batches.
 */
export const editDocumentResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), mintedIds: mintedIdsSchema }),
  z.object({ ok: z.literal(false), errors: z.array(documentEditErrorSchema) }),
]);

export type EditDocumentResult = z.infer<typeof editDocumentResultSchema>;
