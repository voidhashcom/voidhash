import {
  ALLOWED_CHILDREN_BY_NODE_TYPE,
  canBeChildOf,
  isNodeType,
  type NodeType,
} from "@voidhash/mimic-schema";
import { getBuiltinComponent, listBuiltinComponents } from "@voidhash/paywall-builtins";

import {
  acceptanceOf,
  expectedTypeLabel,
  nodeDataFieldSchema,
  nodeDataFields,
  nodeStyleFields,
  nodeStyleSchema,
  type SerializedSchema,
} from "./mimic-introspection.ts";
import { deriveEnabledFlagsForNodeInput, deriveEnabledFlagsForSet } from "./style-group-flags.ts";
import type { DocumentEdit, NodeInput } from "./surfaces.ts";

/**
 * The minimal tree the {@link validateDocumentEdits} validator reads. Both the
 * browser (a decoded designer snapshot) and the backend (a decoded document
 * tree) adapt their node shape to this: an id, a node type, the logical `data`
 * (envelope-unwrapping is not required — the validator only reads scalar/enum
 * leaves it addresses), and children. `data` is optional because containment /
 * move / remove checks don't need it.
 */
export interface EditableDocumentNode {
  readonly id: string;
  readonly type: string;
  readonly data?: Record<string, unknown>;
  readonly children?: readonly EditableDocumentNode[];
}

/**
 * A structured validation error naming exactly what is wrong and — where the
 * schema affords it — the legal alternatives. These messages are the product:
 * they are what the model reads to correct itself, so they are always derived
 * from the mimic schema, never hand-listed.
 */
export interface DocumentEditError {
  /** Index of the offending edit within the submitted batch. */
  readonly editIndex: number;
  /** Coarse failure category, for programmatic handling by the executor. */
  readonly code:
    | "unknownNode"
    | "unknownParent"
    | "illegalChild"
    | "moveCycle"
    | "invalidNodeType"
    | "unknownField"
    | "invalidValue"
    | "indexOutOfBounds"
    | "emptyBatch"
    | "protectedTarget"
    | "overlappingEdits"
    | "missingComponentIdentity";
  /** The mimic node id / parent id / node type the error is about, when applicable. */
  readonly nodeId?: string;
  /** The dotted field path the error is about (e.g. `style.backgroundColor`), when applicable. */
  readonly field?: string;
  /** The full, self-contained, model-facing message. */
  readonly message: string;
}

/** One normalized edit with any minted/derived positions resolved (index clamped). */
export type NormalizedDocumentEdit = DocumentEdit;

/** The outcome of validating a batch: either all normalized ops, or every error found. */
export type ValidateEditsResult =
  | { readonly ok: true; readonly edits: readonly NormalizedDocumentEdit[] }
  | { readonly ok: false; readonly errors: readonly DocumentEditError[] };

/**
 * Validate an atomic batch of document edits against the current tree, deriving
 * every legality rule from the live mimic schema. ALL errors are collected (not
 * just the first) so the model can fix a whole batch in one round-trip.
 *
 * Checks, per edit:
 * - `nodeId` / `parentId` must resolve to an existing node (error names the id);
 * - inserted / moved node types must be legal children of the target parent per
 *   {@link canBeChildOf} (error names the parent type and the allowed child set);
 * - a `move` may not target its own subtree (cycle), nor the document root;
 * - `remove` / `move` / `replaceChildren` may not target a PROTECTED node — the
 *   document root or a `library` / `codeComponent` definition (owned by the
 *   component tools); the error routes to `delete_component`;
 * - a batch may not contain OVERLAPPING edits — two edits on the same node, or an
 *   edit whose target lies inside a subtree another edit removes / replaces (undo
 *   would be ambiguous); the error tells the model to merge or split the batch;
 * - an inserted `component` node must carry identity (`componentSlug` for a
 *   catalog component; `componentPath` + `componentSource: "local"` for a local
 *   code component; `componentSource: "builtin"` + a registered builtin
 *   `componentSlug` for a first-party renderer builtin — builtins are UNPINNED,
 *   so they may not also carry `componentPath`/`componentVersion`/`contentHash`),
 *   else it is a dead placeholder;
 * - a `NodeInput.type` must be a real editable node type — `root` may never be
 *   inserted, and `library` / `codeComponent` are managed by the component tools,
 *   not `edit_paywall`;
 * - every field of an `update.set` / `NodeInput` is validated against the node
 *   type's mimic schema: unknown fields yield a did-you-mean suggestion + the
 *   allowed field list, bad enum values name the allowed values, and wrong scalar
 *   families name the expected type;
 * - `index` is clamped into `[0, childCount]` (see {@link clampIndex}) — never an
 *   error on its own.
 *
 * Index normalization policy: out-of-range indices are CLAMPED, not rejected, so
 * the model's intent ("put it at the end") survives an off-by-one. A negative
 * index clamps to 0; an index past the child count clamps to the count (append).
 *
 * Style-flag normalization: setting ANY field of a renderer-gated style group
 * (background / border / shadow / path fill / stroke) auto-injects that group's
 * `<group>Enabled: true` flag on the pushed `insert` node, `update.set`, and
 * `replaceChildren` children — UNLESS the edit sets the flag explicitly (an
 * explicit `false` keeps the group hidden). This spares the model the
 * designer-only toggle while keeping "disable" expressible (see
 * {@link deriveEnabledFlagsForSet}). It is idempotent: re-validating a normalized
 * batch injects nothing further.
 *
 * @returns `{ ok: true, edits }` with the normalized ops, or `{ ok: false, errors }`
 *   listing every problem found.
 */
export function validateDocumentEdits(
  edits: readonly DocumentEdit[],
  tree: EditableDocumentNode,
): ValidateEditsResult {
  const errors: DocumentEditError[] = [];
  const byId = indexById(tree);

  if (edits.length === 0) {
    return {
      ok: false,
      errors: [
        {
          editIndex: 0,
          code: "emptyBatch",
          message: "edit_paywall was called with an empty `edits` array — provide at least one op.",
        },
      ],
    };
  }

  const normalized: NormalizedDocumentEdit[] = [];

  edits.forEach((edit, editIndex) => {
    switch (edit.op) {
      case "insert": {
        const parent = requireNode(byId, edit.parentId, editIndex, "unknownParent", errors);
        if (parent) {
          const normalizedIndex = clampIndex(edit.index, parent.children?.length ?? 0);
          validateChildType(edit.node.type, parent.type, editIndex, errors);
          validateNodeInput(edit.node, editIndex, `node`, errors);
          normalized.push({
            ...edit,
            index: normalizedIndex,
            node: deriveEnabledFlagsForNodeInput(edit.node),
          });
        }
        break;
      }
      case "update": {
        const node = requireNode(byId, edit.nodeId, editIndex, "unknownNode", errors);
        if (node) {
          validateSet(node.type, edit.set, editIndex, errors);
          const set = deriveEnabledFlagsForSet(node.type, edit.set);
          normalized.push(set === edit.set ? edit : { ...edit, set });
        }
        break;
      }
      case "move": {
        const node = requireNode(byId, edit.nodeId, editIndex, "unknownNode", errors);
        const parent = requireNode(byId, edit.parentId, editIndex, "unknownParent", errors);
        if (node && parent) {
          if (validateMutableTarget(node, tree.id, "move", editIndex, errors)) {
            validateChildType(node.type, parent.type, editIndex, errors);
            if (isSelfOrDescendant(node, edit.parentId)) {
              errors.push({
                editIndex,
                code: "moveCycle",
                nodeId: edit.nodeId,
                message: `Cannot move node \`${edit.nodeId}\` into itself or its own descendant \`${edit.parentId}\` — that would create a cycle.`,
              });
            } else {
              const normalizedIndex = clampIndex(edit.index, parent.children?.length ?? 0);
              normalized.push({ ...edit, index: normalizedIndex });
            }
          }
        }
        break;
      }
      case "remove": {
        const node = requireNode(byId, edit.nodeId, editIndex, "unknownNode", errors);
        if (node && validateMutableTarget(node, tree.id, "remove", editIndex, errors)) {
          normalized.push(edit);
        }
        break;
      }
      case "replaceChildren": {
        const node = requireNode(byId, edit.nodeId, editIndex, "unknownNode", errors);
        if (node && validateMutableTarget(node, tree.id, "replaceChildren", editIndex, errors)) {
          edit.children.forEach((child, childIdx) => {
            validateChildType(child.type, node.type, editIndex, errors);
            validateNodeInput(child, editIndex, `children[${childIdx}]`, errors);
          });
          normalized.push({
            ...edit,
            children: edit.children.map(deriveEnabledFlagsForNodeInput),
          });
        }
        break;
      }
    }
  });

  validateNonOverlapping(edits, byId, errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, edits: normalized };
}

// ---------------------------------------------------------------------------
// Protected-target + batch-overlap checks
// ---------------------------------------------------------------------------

/**
 * The node types `edit_paywall` may never structurally mutate (remove / move /
 * replaceChildren): the singleton `root`/`library` scaffolding and `codeComponent`
 * definitions, which the component tools own. A `move` additionally cannot target
 * the root. Returns `true` when the target is mutable (the caller may continue).
 */
function validateMutableTarget(
  node: EditableDocumentNode,
  rootId: string,
  op: "move" | "remove" | "replaceChildren",
  editIndex: number,
  errors: DocumentEditError[],
): boolean {
  if (node.id === rootId) {
    errors.push({
      editIndex,
      code: "protectedTarget",
      nodeId: node.id,
      message: `Cannot ${op} the document root \`${node.id}\` — it is the unique top-level node and is not mutable.`,
    });
    return false;
  }
  if (node.type === "library" || node.type === "codeComponent") {
    errors.push({
      editIndex,
      code: "protectedTarget",
      nodeId: node.id,
      message: `Cannot ${op} the \`${node.type}\` node \`${node.id}\` — component definitions are managed by the component tools. Use delete_component to remove a component definition (its instances degrade to placeholders), not edit_paywall.`,
    });
    return false;
  }
  return true;
}

/**
 * The node id an edit STRUCTURALLY targets (the node an op reads/mutates by
 * identity): `nodeId` for update/move/remove/replaceChildren, `null` for `insert`
 * (an insert creates fresh nodes and only reads its parent, so it never overlaps).
 */
function targetOf(edit: DocumentEdit): string | null {
  return edit.op === "insert" ? null : edit.nodeId;
}

/**
 * Reject a batch whose edits OVERLAP against the committed tree, which would make
 * the atomic undo ambiguous (a removed subtree already includes its descendants):
 * (a) two edits addressing the SAME node id; (b) an edit whose target node lies
 * inside a subtree another edit removes or replaces wholesale. Both are pushed as
 * `overlappingEdits` errors telling the model to merge or split the batch.
 */
function validateNonOverlapping(
  edits: readonly DocumentEdit[],
  byId: Map<string, EditableDocumentNode>,
  errors: DocumentEditError[],
): void {
  // (a) the same node id targeted more than once.
  const seen = new Map<string, number>();
  edits.forEach((edit, editIndex) => {
    const target = targetOf(edit);
    if (target === null) return;
    const firstIndex = seen.get(target);
    if (firstIndex === undefined) {
      seen.set(target, editIndex);
      return;
    }
    errors.push({
      editIndex,
      code: "overlappingEdits",
      nodeId: target,
      message: `Edit ${editIndex} and edit ${firstIndex} both target node \`${target}\`. Overlapping edits on one node make the atomic undo ambiguous — merge them into one edit, or split them into separate edit_paywall calls.`,
    });
  });

  // (b) a target inside a subtree another edit removes / replaces wholesale.
  const wholesale = edits
    .map((edit, editIndex) => ({ edit, editIndex }))
    .filter(({ edit }) => edit.op === "remove" || edit.op === "replaceChildren");

  edits.forEach((edit, editIndex) => {
    const target = targetOf(edit);
    if (target === null) return;
    for (const { edit: other, editIndex: otherIndex } of wholesale) {
      if (otherIndex === editIndex) continue;
      const otherTarget = targetOf(other);
      if (otherTarget === null || otherTarget === target) continue;
      const otherNode = byId.get(otherTarget);
      // `replaceChildren` drops the DESCENDANTS of its target (its children), while
      // `remove` drops the target itself too — but a target equal to the removed
      // node is already the same-id case above, so both reduce to "is `target` a
      // proper descendant of `otherTarget`".
      if (otherNode && isProperDescendant(otherNode, target)) {
        errors.push({
          editIndex,
          code: "overlappingEdits",
          nodeId: target,
          message: `Edit ${editIndex} targets node \`${target}\`, which is inside the subtree edit ${otherIndex} ${
            other.op === "remove" ? "removes" : "replaces"
          } (\`${otherTarget}\`). Removal already includes descendants, so this overlap is redundant and makes undo ambiguous — drop the inner edit, or split them into separate edit_paywall calls.`,
        });
      }
    }
  });
}

/** Whether `candidateId` is a PROPER descendant of `node` (excludes `node` itself). */
function isProperDescendant(node: EditableDocumentNode, candidateId: string): boolean {
  for (const child of node.children ?? []) {
    if (child.id === candidateId || isProperDescendant(child, candidateId)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Node lookup + structure checks
// ---------------------------------------------------------------------------

/** Build an id → node map from the tree (depth-first). */
function indexById(root: EditableDocumentNode): Map<string, EditableDocumentNode> {
  const map = new Map<string, EditableDocumentNode>();
  const walk = (node: EditableDocumentNode) => {
    map.set(node.id, node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return map;
}

/** Resolve a node by id, pushing a structured error (and returning `null`) if absent. */
function requireNode(
  byId: Map<string, EditableDocumentNode>,
  id: string,
  editIndex: number,
  code: "unknownNode" | "unknownParent",
  errors: DocumentEditError[],
): EditableDocumentNode | null {
  const node = byId.get(id);
  if (node) return node;
  errors.push({
    editIndex,
    code,
    nodeId: id,
    message: `${code === "unknownParent" ? "Parent node" : "Node"} \`${id}\` does not exist in the document. Node ids come from get_paywall or the current selection.`,
  });
  return null;
}

/** Whether `candidateParentId` is `node` itself or lies within `node`'s subtree. */
function isSelfOrDescendant(node: EditableDocumentNode, candidateParentId: string): boolean {
  if (node.id === candidateParentId) return true;
  for (const child of node.children ?? []) {
    if (isSelfOrDescendant(child, candidateParentId)) return true;
  }
  return false;
}

/** Clamp an index into `[0, childCount]` (append when omitted / past the end). */
function clampIndex(index: number | undefined, childCount: number): number {
  if (index === undefined) return childCount;
  if (index < 0) return 0;
  return Math.min(index, childCount);
}

/**
 * Validate a child node type against a parent type: the parent must be a known
 * node type and legally contain the child per {@link canBeChildOf}. The error
 * names the parent type and its full allowed child set.
 */
function validateChildType(
  childType: string,
  parentType: string,
  editIndex: number,
  errors: DocumentEditError[],
): void {
  if (canBeChildOf(childType, parentType)) return;
  const allowed = isNodeType(parentType)
    ? ALLOWED_CHILDREN_BY_NODE_TYPE[parentType as NodeType]
    : [];
  errors.push({
    editIndex,
    code: "illegalChild",
    nodeId: parentType,
    message:
      allowed.length > 0
        ? `Node type \`${childType}\` cannot be a child of \`${parentType}\`. Allowed children of \`${parentType}\`: [${allowed.join(", ")}].`
        : `Node type \`${parentType}\` cannot contain children (attempted to add \`${childType}\`).`,
  });
}

// ---------------------------------------------------------------------------
// Node type + field validation
// ---------------------------------------------------------------------------

/** Node types the AI may create via `edit_paywall` (root/library/codeComponent are excluded). */
const INSERTABLE_NODE_TYPES: readonly NodeType[] = [
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
  "component",
];

/**
 * Validate a `NodeInput` (from `insert` / `replaceChildren`): its `type` must be
 * an insertable node type, and each of its remaining fields must be a legal data
 * field for that type with an accepted value. Children are validated by the
 * caller against their own parent, so this recurses into them too.
 */
function validateNodeInput(
  node: NodeInput,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  if (!isInsertableNodeType(node.type)) {
    errors.push({
      editIndex,
      code: "invalidNodeType",
      field: `${path}.type`,
      message: invalidNodeTypeMessage(node.type),
    });
    return;
  }
  const type = node.type as NodeType;

  // A `component` node must carry a concrete identity, else it inserts a dead
  // placeholder instance (all identity fields default to sentinels).
  if (type === "component") {
    validateComponentIdentity(node, editIndex, path, errors);
  }

  // `name` and `children` are structural; everything else is node data validated
  // against the node type's schema (style is nested).
  for (const [key, value] of Object.entries(node)) {
    if (key === "type" || key === "name" || key === "children") continue;
    validateDataField(type, key, value, editIndex, `${path}.${key}`, errors);
  }

  for (const child of node.children ?? []) {
    // Child's own type legality against THIS node is checked by the caller path
    // (validateChildType) when it descends; here we validate the child's fields.
    if (isInsertableNodeType(child.type)) {
      validateNodeInput(child, editIndex, `${path}.children`, errors);
    }
  }
}

/**
 * A non-empty string field of a node input, else `undefined` (trimmed empty
 * strings and non-strings count as absent).
 */
function nonEmptyString(node: NodeInput, key: string): string | undefined {
  const value = node[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * Validate that an inserted `component` node names WHICH component it instances,
 * across the three identity shapes: a non-empty `componentSlug` (a catalog
 * component); a non-empty `componentPath` with `componentSource: "local"` (an
 * in-document code component); or `componentSource: "builtin"` with a registered
 * builtin `componentSlug` (a first-party renderer builtin). Without one, every
 * identity field defaults to a sentinel and the instance renders a dead
 * placeholder — so the error names the valid shapes.
 *
 * Builtins are UNPINNED and pathless: a builtin instance may NOT also carry
 * `componentPath` / `componentVersion` / `contentHash` (those are catalog/local
 * pinning fields), and its slug must resolve in {@link getBuiltinComponent}, else
 * the error lists the valid builtin slugs.
 */
function validateComponentIdentity(
  node: NodeInput,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  const slug = nonEmptyString(node, "componentSlug");
  const componentPath = nonEmptyString(node, "componentPath");
  const source = node["componentSource"];

  if (source === "builtin") {
    validateBuiltinIdentity(node, slug, componentPath, editIndex, path, errors);
    return;
  }

  const local = source === "local";
  if (slug !== undefined || (componentPath !== undefined && local)) {
    return;
  }
  errors.push({
    editIndex,
    code: "missingComponentIdentity",
    field: `${path}`,
    message:
      'A `component` node must name which component to place. Provide `componentSlug` (a catalog component from get_components), OR both `componentPath` (a local `components/<name>.tsx`) and `componentSource: "local"`, OR `componentSource: "builtin"` with a builtin `componentSlug` from get_components. Without one it inserts a dead placeholder.',
  });
}

/**
 * Validate a `componentSource: "builtin"` instance: it must name a `componentSlug`
 * that resolves in the builtin registry, and — because builtins are UNPINNED and
 * ship with the renderer — must NOT carry the catalog/local pinning fields
 * (`componentPath` / `componentVersion` / `contentHash`). Errors list the valid
 * builtin slugs so the model can self-correct.
 */
function validateBuiltinIdentity(
  node: NodeInput,
  slug: string | undefined,
  componentPath: string | undefined,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  if (slug === undefined) {
    errors.push({
      editIndex,
      code: "missingComponentIdentity",
      field: `${path}`,
      message: `A builtin \`component\` node (\`componentSource: "builtin"\`) must name its \`componentSlug\`. Valid builtins: [${builtinSlugList()}].`,
    });
    return;
  }
  if (getBuiltinComponent(slug) === undefined) {
    errors.push({
      editIndex,
      code: "missingComponentIdentity",
      field: `${path}`,
      message: `Unknown builtin \`componentSlug\` \`${slug}\`. Valid builtins: [${builtinSlugList()}].`,
    });
    return;
  }
  const version = node["componentVersion"];
  const offenders: string[] = [];
  if (componentPath !== undefined) offenders.push("componentPath");
  if (typeof version === "number" && version !== 0) offenders.push("componentVersion");
  if (nonEmptyString(node, "contentHash") !== undefined) offenders.push("contentHash");
  if (offenders.length > 0) {
    errors.push({
      editIndex,
      code: "missingComponentIdentity",
      field: `${path}`,
      message: `A builtin \`component\` node is UNPINNED and pathless — remove [${offenders.join(", ")}]. A builtin is resolved by \`componentSlug\` alone; it carries no \`componentPath\`/\`componentVersion\`/\`contentHash\`.`,
    });
  }
}

/** The comma-joined list of registered builtin slugs, for identity error messages. */
function builtinSlugList(): string {
  return listBuiltinComponents()
    .map((builtin) => builtin.slug)
    .join(", ");
}

/**
 * Validate an `update.set` partial: each top-level key must be a legal data field
 * of the node type, and `style.*` sub-keys must be legal style fields with
 * accepted values. Component prop/action shapes are validated loosely (their
 * inner binding shape is enforced downstream at apply time).
 */
function validateSet(
  type: string,
  set: Record<string, unknown>,
  editIndex: number,
  errors: DocumentEditError[],
): void {
  if (!isNodeType(type)) return;
  const nodeType = type as NodeType;
  for (const [key, value] of Object.entries(set)) {
    if (key === "name") continue;
    validateDataField(nodeType, key, value, editIndex, key, errors);
  }
}

/**
 * Validate one data field of a node type against its schema. `style` recurses
 * into per-style-field validation; other scalar/enum data fields (`text`, `d`,
 * …) are validated against their own serialized schema. Unknown fields yield a
 * did-you-mean suggestion + the allowed field list.
 */
function validateDataField(
  type: NodeType,
  key: string,
  value: unknown,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  const allowedFields = nodeDataFields(type);
  if (!allowedFields.includes(key)) {
    errors.push(unknownFieldError(editIndex, path, key, type, allowedFields, "data field"));
    return;
  }

  if (key === "style") {
    validateStyle(type, value, editIndex, path, errors);
    return;
  }

  // Component props/actionBindings are arrays of structured bindings; their inner
  // shape is enforced at apply time — accept the array shape here.
  if (key === "props" || key === "actionBindings") return;

  const schema = nodeDataFieldSchema(type, key);
  if (schema) validateScalar(schema, value, editIndex, path, errors);
}

/** Validate a `style` object: every key must be a legal style field with an accepted value. */
function validateStyle(
  type: NodeType,
  value: unknown,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push({
      editIndex,
      code: "invalidValue",
      field: path,
      message: `\`${path}\` must be an object of style fields, got ${describeValue(value)}.`,
    });
    return;
  }
  const styleSchema = nodeStyleSchema(type);
  const allowedStyleFields = nodeStyleFields(type);
  if (!styleSchema) {
    errors.push({
      editIndex,
      code: "unknownField",
      field: path,
      message: `Node type \`${type}\` has no \`style\` — remove it from the update.`,
    });
    return;
  }
  for (const [styleKey, styleValue] of Object.entries(value as Record<string, unknown>)) {
    const fieldSchema = styleSchema.fields[styleKey];
    if (!fieldSchema) {
      errors.push(
        unknownFieldError(
          editIndex,
          `${path}.${styleKey}`,
          styleKey,
          type,
          allowedStyleFields,
          "style field",
        ),
      );
      continue;
    }
    validateScalar(fieldSchema, styleValue, editIndex, `${path}.${styleKey}`, errors);
  }
}

/**
 * Validate a scalar/enum value against a serialized schema, deriving the error
 * from the schema: a value outside a closed enum names the allowed values; a
 * wrong scalar family names the expected type. Structured fields (object/array)
 * are accepted as-is (their inner shape is not re-validated here — the model
 * rarely writes them, and apply-time validation is authoritative).
 */
function validateScalar(
  schema: SerializedSchema,
  value: unknown,
  editIndex: number,
  path: string,
  errors: DocumentEditError[],
): void {
  const acc = acceptanceOf(schema);
  if (acc.isStructured) return;

  // Closed enum: value must be one of the literals.
  const isClosedEnum =
    acc.literals.length > 0 && !acc.acceptsNumber && !acc.acceptsBoolean && !acc.acceptsString;
  if (isClosedEnum) {
    if (!acc.literals.includes(value as string | number | boolean)) {
      errors.push({
        editIndex,
        code: "invalidValue",
        field: path,
        message: `Invalid value ${describeValue(value)} for \`${path}\`. Allowed values: [${acc.literals.map((l) => JSON.stringify(l)).join(", ")}].`,
      });
    }
    return;
  }

  // Open union / scalar: the value must be in one of the accepted families (a
  // literal counts as its own value; number/boolean/string per acceptance).
  const family = valueFamily(value);
  const familyOk =
    (family === "number" && acc.acceptsNumber) ||
    (family === "boolean" && acc.acceptsBoolean) ||
    (family === "string" && acc.acceptsString) ||
    acc.literals.includes(value as string | number | boolean);
  if (!familyOk) {
    errors.push({
      editIndex,
      code: "invalidValue",
      field: path,
      message: `Expected ${expectedTypeLabel(schema)}${acc.literals.length ? ` (or one of [${acc.literals.map((l) => JSON.stringify(l)).join(", ")}])` : ""} for \`${path}\`, got ${describeValue(value)}.`,
    });
    return;
  }

  // Regex-constrained strings (e.g. RGBA colors): the value must match.
  if (family === "string" && acc.regexes.length > 0) {
    const str = value as string;
    const matches = acc.regexes.some((r) => safeRegexTest(r.pattern, r.flags, str));
    if (!matches) {
      errors.push({
        editIndex,
        code: "invalidValue",
        field: path,
        message: `String value ${JSON.stringify(str)} for \`${path}\` does not match the required format (${acc.regexes.map((r) => r.pattern).join(" | ")}).`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function unknownFieldError(
  editIndex: number,
  path: string,
  key: string,
  type: NodeType,
  allowed: readonly string[],
  kindLabel: string,
): DocumentEditError {
  const suggestion = nearestField(key, allowed);
  const didYouMean = suggestion ? ` did you mean \`${suggestion}\`?` : "";
  return {
    editIndex,
    code: "unknownField",
    field: path,
    message: `Unknown ${kindLabel} \`${key}\` on \`${type}\`;${didYouMean} allowed: [${allowed.join(", ")}].`,
  };
}

function invalidNodeTypeMessage(type: string): string {
  if (type === "root") {
    return `Cannot insert a \`root\` node — the document root already exists and is unique.`;
  }
  if (type === "library" || type === "codeComponent") {
    return `Node type \`${type}\` is managed by the component tools (write_component / rename_component / delete_component), not edit_paywall.`;
  }
  const suggestion = nearestField(type, INSERTABLE_NODE_TYPES);
  const didYouMean = suggestion ? ` Did you mean \`${suggestion}\`?` : "";
  return `Unknown node type \`${type}\`.${didYouMean} Insertable types: [${INSERTABLE_NODE_TYPES.join(", ")}].`;
}

function isInsertableNodeType(type: string): boolean {
  return INSERTABLE_NODE_TYPES.includes(type as NodeType);
}

/** The scalar family of a runtime value, for family-mismatch errors. */
function valueFamily(value: unknown): "number" | "boolean" | "string" | "other" {
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "other";
}

/** A short human description of a value for error messages. */
function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return Array.isArray(value) ? "an array" : "an object";
  return String(value);
}

/** Test a serialized regex safely; a malformed pattern rejects rather than throws. */
function safeRegexTest(pattern: string, flags: string | undefined, value: string): boolean {
  try {
    return new RegExp(pattern, flags).test(value);
  } catch {
    return false;
  }
}

/**
 * The nearest candidate to `key` by Levenshtein distance, or `undefined` when no
 * candidate is close enough (distance ≤ 3 and < half the key length) to be a
 * useful "did you mean". Powers the did-you-mean suggestions.
 */
function nearestField(key: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(key.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  const threshold = Math.min(3, Math.floor(key.length / 2) + 1);
  return best !== undefined && bestDistance <= threshold ? best : undefined;
}

/** Classic iterative Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i++) {
    let prev = dist[0]!;
    dist[0] = i;
    for (let j = 1; j < cols; j++) {
      const temp = dist[j]!;
      dist[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dist[j]!, dist[j - 1]!);
      prev = temp;
    }
  }
  return dist[cols - 1]!;
}
