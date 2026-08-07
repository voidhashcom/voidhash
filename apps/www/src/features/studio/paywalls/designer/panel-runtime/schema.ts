/**
 * Host-authoritative Effect Schema gate for the editor {@link PanelTree} wire
 * format (`@voidhash/paywalls/schema`).
 *
 * A code-component panel runs its React reconciler inside a sandboxed iframe and
 * posts a serialized {@link PanelTree} to the host, which renders it with real
 * kit components. The panel channel is a trust boundary: NOTHING the sandbox
 * emits is trusted. Every tree crossing into the host passes through
 * {@link decodePanelTree} — a strict, value-level Effect Schema decode plus a
 * byte-size pre-check and the traversal-enforced caps in `PANEL_CAPS`.
 *
 * The OSS `parsePanelTree` (which authors validate against) is the STRUCTURAL
 * validator: it closes the per-type prop/event vocabulary and the resource caps
 * but leaves prop VALUES loosely typed. This host gate is at least as strict —
 * it additionally value-types every prop per the wire contract v1 — so anything
 * the host accepts, the OSS validator also accepts (`schema.contract.test.ts`
 * locks this superset relationship).
 *
 * Built-in panels run in-process (trusted), but a `dev`-mode decode
 * ({@link decodePanelTreeDev}) asserts every built-in emission against this same
 * gate so drift between an author's mental model and the host is caught early.
 */
import {
  PANEL_CAPS,
  PANEL_ICON_NAME_LIST,
  PANEL_NODE_SPECS,
  PANEL_TREE_VERSION,
} from "@voidhash/paywalls/schema";
import { Effect, Option, Result, Schema } from "effect";

/**
 * Strictest decode the host applies to sandbox-originated payloads: every issue
 * is reported and any excess/unknown key is rejected. Mirrors
 * `PaywallDeployManifest.strictParseOptions`; it is what makes the closed
 * per-type prop vocabulary enforceable at the Schema layer.
 */
export const strictParseOptions = {
  errors: "all",
  onExcessProperty: "error",
} as const;

// =============================================================================
// Primitive value schemas
// =============================================================================

/**
 * A JSON-safe value permitted inside any panel node's `props`. Numbers are
 * decoded as {@link Schema.Finite} (JSON cannot carry NaN/Infinity, so this
 * rejects nothing the OSS validator accepts).
 */
export type PanelJsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<PanelJsonValue>
  | { readonly [key: string]: PanelJsonValue };

const PanelJsonValueSchema: Schema.Codec<PanelJsonValue> = Schema.Union([
  Schema.Null,
  Schema.Boolean,
  Schema.Finite,
  Schema.String,
  Schema.Array(Schema.suspend((): Schema.Codec<PanelJsonValue> => PanelJsonValueSchema)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<PanelJsonValue> => PanelJsonValueSchema),
  ),
]);

/** A prop string value, capped at `PANEL_CAPS.stringLength`. */
const CappedString = Schema.String.check(Schema.isMaxLength(PANEL_CAPS.stringLength));

/** The closed set of icon tokens a panel may reference (wire contract §IconName). */
const IconName = Schema.Literals(PANEL_ICON_NAME_LIST);

/** A non-negative integer reconciler instance id. */
const NodeId = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

// =============================================================================
// Shared prop shapes
// =============================================================================

/** `selectField` / `toggleGroup` option: a value plus optional label/icon. */
const OptionSchema = Schema.Struct({
  value: CappedString,
  label: Schema.optional(CappedString),
  icon: Schema.optional(IconName),
  disabled: Schema.optional(Schema.Boolean),
});

/** `menu` item — same serializable shape as {@link OptionSchema}. */
const MenuItemSchema = OptionSchema;

/** A `gradientStops` stop: `{ id, position, color }` (wire contract). */
const GradientStopSchema = Schema.Struct({
  id: Schema.Finite,
  position: Schema.Finite,
  color: CappedString,
});

/** A `fillField` gradient stop: `{ color, position }` (mirrors host fill props). */
const FillGradientStopSchema = Schema.Struct({
  color: CappedString,
  position: Schema.Finite,
});

/** A `fillField` gradient value (mirrors `FillEditorPopoverContentProps.gradient`). */
const FillGradientSchema = Schema.Struct({
  kind: Schema.Literals(["linear", "radial"]),
  startX: Schema.Finite,
  startY: Schema.Finite,
  endX: Schema.Finite,
  endY: Schema.Finite,
  stops: Schema.Array(FillGradientStopSchema).check(
    Schema.isMaxLength(PANEL_CAPS.gradientStops),
  ),
});

/** A `fillField` / `imageField` image value. */
const ImageValueSchema = Schema.Struct({
  url: CappedString,
  resizeMode: Schema.optional(CappedString),
});

/** A `textField.trailingMenu` value (line-height Auto/Fixed etc.). */
const TrailingMenuSchema = Schema.Struct({
  items: Schema.Array(MenuItemSchema).check(Schema.isMaxLength(PANEL_CAPS.options)),
  value: Schema.optional(CappedString),
});

/**
 * A serializable `LabeledVariable` the `actionEditorField` carries in its
 * `variables` / `productVariables` prop lists: the flat `{ id, name, value }`
 * variable plus the optional picker annotations (`ownerLabel`, `aliasId`). The
 * `value` is a variable-type envelope (`{ key, value }`), decoded as loose JSON
 * so every variable-type shape (string/number/boolean/product) round-trips.
 */
const LabeledVariableSchema = Schema.Struct({
  id: CappedString,
  name: CappedString,
  value: Schema.Struct({
    key: CappedString,
    value: PanelJsonValueSchema,
  }),
  ownerLabel: Schema.optional(CappedString),
  aliasId: Schema.optional(CappedString),
});

// =============================================================================
// Per-node-type node schemas
// =============================================================================

/**
 * Builds one node schema for a type: a `type` literal, a non-negative-integer
 * `id`, a closed `props` struct, an `events` array restricted to the type's
 * allowlist (deduped + capped in {@link decodePanelTree}), and — for
 * child-bearing types only — a `children` array of suspended nodes.
 */
const makeNode = <T extends keyof typeof PANEL_NODE_SPECS>(
  type: T,
  props: Schema.Struct.Fields,
) => {
  const spec = PANEL_NODE_SPECS[type];
  // Zero-event types accept only `[]`; the OSS validator rejects any event name
  // for a type with an empty allowlist, and an empty tuple mirrors that exactly.
  const events =
    spec.events.length === 0
      ? Schema.Tuple([])
      : Schema.Array(Schema.Literals(spec.events as unknown as ReadonlyArray<string>));
  const base = {
    type: Schema.Literal(type),
    id: NodeId,
    props: Schema.Struct(props),
    events,
  } as const;
  if (spec.children) {
    return Schema.Struct({
      ...base,
      children: Schema.Array(Schema.suspend((): Schema.Codec<PanelNode> => PanelNodeSchema)),
    });
  }
  return Schema.Struct(base);
};

const OptionalString = Schema.optional(CappedString);
const OptionalBoolean = Schema.optional(Schema.Boolean);
const OptionalFinite = Schema.optional(Schema.Finite);
const OptionalIcon = Schema.optional(IconName);
const OptionalJson = Schema.optional(PanelJsonValueSchema);

// ── Chrome / layout ──────────────────────────────────────────────────────────
const PanelRootNodeSchema = makeNode("panel", {});
const SectionNodeSchema = makeNode("section", {
  title: OptionalString,
  collapsible: OptionalBoolean,
  defaultCollapsed: OptionalBoolean,
});
const SectionActionsNodeSchema = makeNode("sectionActions", {});
const SubsectionNodeSchema = makeNode("subsection", { title: OptionalString });
const RowNodeSchema = makeNode("row", {
  gap: OptionalString,
  width: OptionalString,
  align: OptionalString,
  justify: OptionalString,
});
const ColumnNodeSchema = makeNode("column", {
  gap: OptionalString,
  width: OptionalString,
  align: OptionalString,
});
const FieldNodeSchema = makeNode("field", { label: OptionalString, icon: OptionalIcon });
const TextNodeSchema = makeNode("text", {
  content: OptionalString,
  variant: OptionalString,
  tone: OptionalString,
});
const CalloutNodeSchema = makeNode("callout", { message: OptionalString, tone: OptionalString });
const PopoverNodeSchema = makeNode("popover", { open: OptionalBoolean });
const PopoverTriggerNodeSchema = makeNode("popoverTrigger", {});
const PopoverContentNodeSchema = makeNode("popoverContent", {
  align: OptionalString,
  side: OptionalString,
});
const MenuNodeSchema = makeNode("menu", {
  items: Schema.optional(
    Schema.Array(MenuItemSchema).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
  value: OptionalString,
  align: OptionalString,
});

// ── Controls ─────────────────────────────────────────────────────────────────
const TextFieldNodeSchema = makeNode("textField", {
  kind: Schema.optional(Schema.Literals(["text", "number"])),
  value: Schema.optional(Schema.Union([CappedString, Schema.Finite, Schema.Null])),
  mixed: OptionalBoolean,
  placeholder: OptionalString,
  min: OptionalFinite,
  max: OptionalFinite,
  step: OptionalFinite,
  icon: OptionalIcon,
  disabled: OptionalBoolean,
  trailingMenu: Schema.optional(TrailingMenuSchema),
});
const SelectFieldNodeSchema = makeNode("selectField", {
  value: Schema.optional(Schema.Union([CappedString, Schema.Null])),
  options: Schema.optional(
    Schema.Array(OptionSchema).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
  placeholder: OptionalString,
  mixed: OptionalBoolean,
  disabled: OptionalBoolean,
});
const ToggleGroupNodeSchema = makeNode("toggleGroup", {
  value: Schema.optional(Schema.Union([CappedString, Schema.Null])),
  options: Schema.optional(
    Schema.Array(OptionSchema).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
  mixed: OptionalBoolean,
  disabled: OptionalBoolean,
});
const SwitchFieldNodeSchema = makeNode("switchField", {
  checked: OptionalBoolean,
  mixed: OptionalBoolean,
  label: OptionalString,
  disabled: OptionalBoolean,
});
const ButtonNodeSchema = makeNode("button", {
  label: OptionalString,
  icon: OptionalIcon,
  variant: OptionalString,
  size: OptionalString,
  disabled: OptionalBoolean,
});
const SliderFieldNodeSchema = makeNode("sliderField", {
  value: OptionalFinite,
  min: OptionalFinite,
  max: OptionalFinite,
  step: OptionalFinite,
  mixed: OptionalBoolean,
  disabled: OptionalBoolean,
});
const ResetAffordanceNodeSchema = makeNode("resetAffordance", {
  show: OptionalBoolean,
  label: OptionalString,
});

// ── Composites ───────────────────────────────────────────────────────────────
const ColorFieldNodeSchema = makeNode("colorField", {
  value: OptionalString,
  mixed: OptionalBoolean,
  mixedLabel: OptionalString,
  disabled: OptionalBoolean,
});
const ColorPickerNodeSchema = makeNode("colorPicker", {
  color: OptionalString,
  opacity: OptionalFinite,
});
const GradientStopsNodeSchema = makeNode("gradientStops", {
  stops: Schema.optional(
    Schema.Array(GradientStopSchema).check(Schema.isMaxLength(PANEL_CAPS.gradientStops)),
  ),
  selectedStopId: Schema.optional(Schema.Union([Schema.Finite, Schema.Null])),
});
const SwatchNodeSchema = makeNode("swatch", {
  color: OptionalString,
  imageUrl: Schema.optional(Schema.Union([CappedString, Schema.Null])),
});
const ImageFieldNodeSchema = makeNode("imageField", {
  url: OptionalString,
  resizeMode: OptionalString,
});
const AlignmentGridNodeSchema = makeNode("alignmentGrid", {
  flexDirection: OptionalString,
  alignItems: OptionalString,
  justifyContent: OptionalString,
  mixed: OptionalBoolean,
});
const DimensionFieldNodeSchema = makeNode("dimensionField", {
  axis: OptionalString,
  mode: OptionalString,
  value: Schema.optional(Schema.Union([CappedString, Schema.Finite, Schema.Null])),
  label: OptionalString,
  mixed: OptionalBoolean,
  disabled: OptionalBoolean,
  computed: Schema.optional(Schema.Union([CappedString, Schema.Finite, Schema.Null])),
});
const FillFieldNodeSchema = makeNode("fillField", {
  label: OptionalString,
  backgroundType: OptionalString,
  isTypeMixed: OptionalBoolean,
  backgroundColor: OptionalString,
  gradient: Schema.optional(Schema.Union([FillGradientSchema, Schema.Null])),
  selectedStopIndex: Schema.optional(Schema.Union([Schema.Finite, Schema.Null])),
  image: Schema.optional(Schema.Union([ImageValueSchema, Schema.Null])),
  open: OptionalBoolean,
});
const VariableFieldNodeSchema = makeNode("variableField", {
  variableId: Schema.optional(Schema.Union([CappedString, Schema.Null])),
  variableName: OptionalString,
  variableType: OptionalString,
  allowedKinds: Schema.optional(
    Schema.Array(CappedString).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
  label: OptionalString,
});
const ActionEditorFieldNodeSchema = makeNode("actionEditorField", {
  value: OptionalJson,
  variables: Schema.optional(Schema.Array(LabeledVariableSchema)),
  productVariables: Schema.optional(Schema.Array(LabeledVariableSchema)),
  payloadFields: Schema.optional(
    Schema.Array(CappedString).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
});
const ProductFieldNodeSchema = makeNode("productField", {
  productId: OptionalString,
  placeholder: OptionalString,
  disabled: OptionalBoolean,
  label: OptionalString,
});
const PropFieldNodeSchema = makeNode("propField", { name: OptionalString });
const DefaultPropsNodeSchema = makeNode("defaultProps", {
  exclude: Schema.optional(
    Schema.Array(CappedString).check(Schema.isMaxLength(PANEL_CAPS.options)),
  ),
});

// =============================================================================
// Node union + tree envelope
// =============================================================================

/**
 * The decoded shape of one panel node. The per-type structs value-type props and
 * close the vocabulary; at the union boundary the traversal only relies on the
 * fields shared by every node, so this structural type is intentionally loose.
 */
export interface PanelNode {
  readonly type: string;
  readonly id: number;
  readonly props: { readonly [key: string]: unknown };
  readonly events: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<PanelNode>;
}

/**
 * The closed discriminated union of every v1 panel node, keyed by `type`.
 *
 * The annotation is applied through a cast because the member structs are not
 * type-uniform (each closes a different `props` shape, and childless types omit
 * `children`), so their inferred union `.Type` does not structurally widen to
 * the loose {@link PanelNode} the recursion seam and traversal use. The runtime
 * decode is unaffected — the cast only relaxes the compile-time recursion type.
 */
export const PanelNodeSchema = Schema.Union([
  PanelRootNodeSchema,
  SectionNodeSchema,
  SectionActionsNodeSchema,
  SubsectionNodeSchema,
  RowNodeSchema,
  ColumnNodeSchema,
  FieldNodeSchema,
  TextNodeSchema,
  CalloutNodeSchema,
  PopoverNodeSchema,
  PopoverTriggerNodeSchema,
  PopoverContentNodeSchema,
  MenuNodeSchema,
  TextFieldNodeSchema,
  SelectFieldNodeSchema,
  ToggleGroupNodeSchema,
  SwitchFieldNodeSchema,
  ButtonNodeSchema,
  SliderFieldNodeSchema,
  ResetAffordanceNodeSchema,
  ColorFieldNodeSchema,
  ColorPickerNodeSchema,
  GradientStopsNodeSchema,
  SwatchNodeSchema,
  ImageFieldNodeSchema,
  AlignmentGridNodeSchema,
  DimensionFieldNodeSchema,
  FillFieldNodeSchema,
  VariableFieldNodeSchema,
  ActionEditorFieldNodeSchema,
  ProductFieldNodeSchema,
  PropFieldNodeSchema,
  DefaultPropsNodeSchema,
]) as unknown as Schema.Codec<PanelNode>;

/**
 * The full panel tree envelope: `{ version: 1, root: <panel node> }`. The root
 * must be a `panel` node ({@link PanelRootNodeSchema}); the envelope rejects any
 * key other than `version`/`root` under {@link strictParseOptions}.
 */
export const PanelTreeSchema = Schema.Struct({
  version: Schema.Literal(PANEL_TREE_VERSION),
  root: PanelRootNodeSchema,
}) as unknown as Schema.Codec<PanelTree>;

/** A decoded, host-trusted panel tree: the `panel` root plus the wire version. */
export interface PanelTree {
  readonly version: typeof PANEL_TREE_VERSION;
  readonly root: PanelNode;
}

// =============================================================================
// Cap traversal (caps awkward to express purely in the schema)
// =============================================================================

interface CapState {
  count: number;
  readonly ids: Set<number>;
}

/**
 * After a successful strict decode, walks the tree once to enforce the caps and
 * uniqueness rules the Schema layer cannot express structurally: total node
 * count, nesting depth, unique ids, and the per-node event count/duplicate
 * rules. Returns the first violation message, or `null`.
 */
const checkNodeCaps = (
  node: PanelNode,
  path: string,
  depth: number,
  state: CapState,
): string | null => {
  if (depth > PANEL_CAPS.depth) {
    return `${path} exceeds max depth ${PANEL_CAPS.depth}`;
  }
  state.count += 1;
  if (state.count > PANEL_CAPS.nodes) {
    return `tree exceeds ${PANEL_CAPS.nodes} nodes`;
  }
  if (state.ids.has(node.id)) {
    return `${path}.id ${node.id} is duplicated`;
  }
  state.ids.add(node.id);

  if (node.events.length > PANEL_CAPS.eventsPerNode) {
    return `${path}.events exceeds ${PANEL_CAPS.eventsPerNode} events`;
  }
  const seenEvents = new Set<string>();
  for (const event of node.events) {
    if (seenEvents.has(event)) {
      return `${path}.events has duplicate event "${event}"`;
    }
    seenEvents.add(event);
  }

  const children = node.children;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      const error = checkNodeCaps(
        children[i] as PanelNode,
        `${path}.children[${i}]`,
        depth + 1,
        state,
      );
      if (error !== null) return error;
    }
  }
  return null;
};

// =============================================================================
// Public decode entry points
// =============================================================================

/** Discriminated result of {@link decodePanelTree}. */
export type DecodePanelResult =
  | { readonly ok: true; readonly tree: PanelTree }
  | { readonly ok: false; readonly error: string };

/** Options accepted by {@link decodePanelTree}. */
export interface DecodePanelTreeOptions {
  /**
   * When `true`, the byte-size pre-check for a serialized-string input is
   * skipped. Only for the in-process built-in transport, which decodes an
   * already-in-memory object (never a string) and never crosses the sandbox
   * boundary — a serialized string ALWAYS pays the byte cap.
   */
  readonly trusted?: boolean;
}

const decodePanelTreeStrict = Schema.decodeUnknownSync(PanelTreeSchema, strictParseOptions);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const byteLength = (input: string): number => new TextEncoder().encode(input).length;

/**
 * The host's authoritative gate for a sandbox-originated panel tree. Combines a
 * byte-size pre-check (≤ `PANEL_CAPS.treeBytes` when given a serialized string,
 * mirroring `SandboxHost.validateTree`), a strict value-level Schema decode
 * (closed prop keys, typed values, allowlisted events, discriminated by
 * `type`), and a single cap traversal (node count, depth, unique ids, per-node
 * event count/dedup). Returns a discriminated {@link DecodePanelResult} — never
 * throws.
 *
 * @param input - the raw tree object, or its serialized JSON string.
 * @param opts - decode options (see {@link DecodePanelTreeOptions}).
 */
export const decodePanelTree = (
  input: unknown,
  opts: DecodePanelTreeOptions = {},
): DecodePanelResult => {
  let value: unknown = input;
  if (typeof input === "string") {
    if (!opts.trusted && byteLength(input) > PANEL_CAPS.treeBytes) {
      return { ok: false, error: `tree exceeds ${PANEL_CAPS.treeBytes} bytes` };
    }
    const parsed = Effect.runSync(
      Effect.try(() => JSON.parse(input) as unknown).pipe(Effect.option),
    );
    if (Option.isNone(parsed)) {
      return { ok: false, error: "tree is not valid JSON" };
    }
    value = parsed.value;
  }

  const decoded = Effect.runSync(
    Effect.try({
      try: () => decodePanelTreeStrict(value),
      catch: (error) => errorMessage(error),
    }).pipe(Effect.result),
  );
  if (Result.isFailure(decoded)) {
    return { ok: false, error: `invalid panel tree: ${decoded.failure}` };
  }
  const tree: PanelTree = decoded.success;

  const capError = checkNodeCaps(tree.root as PanelNode, "tree.root", 1, {
    count: 0,
    ids: new Set<number>(),
  });
  if (capError !== null) {
    return { ok: false, error: capError };
  }
  return { ok: true, tree };
};

/**
 * Dev-mode variant used by the in-process built-in panel transport: decodes on
 * every built-in emission to catch drift, treating the input as trusted (no
 * byte pre-check). Thin wrapper over {@link decodePanelTree} with
 * `trusted: true`.
 */
export const decodePanelTreeDev = (input: unknown): DecodePanelResult =>
  decodePanelTree(input, { trusted: true });

// =============================================================================
// Panel intent channel
// =============================================================================

/** The gesture phase of a `set-prop` write (mirrors OSS `PanelGesture`). */
const PanelGestureSchema = Schema.Literals(["live", "commit"]);

const SetPropIntentSchema = Schema.Struct({
  type: Schema.Literal("set-prop"),
  name: CappedString,
  value: PanelJsonValueSchema,
  gesture: PanelGestureSchema,
});

const SetRefIntentSchema = Schema.Struct({
  type: Schema.Literal("set-ref"),
  name: CappedString,
  productId: CappedString,
});

const ResetPropIntentSchema = Schema.Struct({
  type: Schema.Literal("reset-prop"),
  name: CappedString,
});

const GestureCommitIntentSchema = Schema.Struct({
  type: Schema.Literal("gesture-commit"),
  name: CappedString,
});

const GestureDiscardIntentSchema = Schema.Struct({
  type: Schema.Literal("gesture-discard"),
  name: CappedString,
});

/**
 * The closed union of every intent a panel emits, matching the OSS
 * `PanelIntent` (`@voidhash/paywalls/panel`) exactly: `set-prop` (with a
 * `gesture` of `live`/`commit`), `set-ref` (P0-B), `reset-prop`,
 * `gesture-commit`, and `gesture-discard` — the last three carrying the target
 * prop `name`.
 */
export const PanelIntentSchema = Schema.Union([
  SetPropIntentSchema,
  SetRefIntentSchema,
  ResetPropIntentSchema,
  GestureCommitIntentSchema,
  GestureDiscardIntentSchema,
]);

/** A decoded, host-trusted panel intent. */
export type PanelIntent = typeof PanelIntentSchema.Type;

/** Discriminated result of {@link decodePanelIntent}. */
export type DecodePanelIntentResult =
  | { readonly ok: true; readonly intent: PanelIntent }
  | { readonly ok: false; readonly error: string };

const decodePanelIntentStrict = Schema.decodeUnknownSync(PanelIntentSchema, strictParseOptions);

/**
 * The host's authoritative gate for a sandbox-originated {@link PanelIntent}.
 * Enforces the `PANEL_CAPS.intentBytes` (32 KB) cap on a `set-prop` intent's
 * `value` before the strict decode — the intent channel is where that cap
 * lives (the tree validator never sees intents). Returns a discriminated
 * {@link DecodePanelIntentResult} — never throws.
 */
export const decodePanelIntent = (input: unknown): DecodePanelIntentResult => {
  if (
    typeof input === "object" &&
    input !== null &&
    (input as { type?: unknown }).type === "set-prop"
  ) {
    const value = (input as { value?: unknown }).value;
    const size = Effect.runSync(
      Effect.try(() => byteLength(JSON.stringify(value ?? null))).pipe(Effect.option),
    );
    if (Option.isNone(size)) {
      return { ok: false, error: "intent value is not serializable" };
    }
    if (size.value > PANEL_CAPS.intentBytes) {
      return { ok: false, error: `intent value exceeds ${PANEL_CAPS.intentBytes} bytes` };
    }
  }

  const decoded = Effect.runSync(
    Effect.try({
      try: () => decodePanelIntentStrict(input),
      catch: (error) => errorMessage(error),
    }).pipe(Effect.result),
  );
  if (Result.isFailure(decoded)) {
    return { ok: false, error: `invalid panel intent: ${decoded.failure}` };
  }
  return { ok: true, intent: decoded.success };
};
