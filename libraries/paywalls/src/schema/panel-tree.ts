/**
 * The editor **PanelTree** wire format — the serializable description of a
 * designer right-panel that a code component (or a built-in panel) renders.
 *
 * Author JS runs only inside a sandboxed iframe: a custom react-reconciler
 * turns the author's panel component into this closed, JSON-safe tree and posts
 * it to the host. The host (Studio designer) renders it with real kit
 * components. **Functions never cross the boundary** — every interactive node
 * carries an `events` array of the event names present on it, and the host
 * addresses a fired event by `(nodeId, eventName)`. Only schema-validated data
 * crosses back to the sandbox.
 *
 * This module is intentionally **dependency-free** (mirrors `node-tree.ts`): no
 * `react`, no `effect`, type-only and self-contained, so it is safe to import
 * from the sandbox, the host, or the server trust boundary alike. The closed
 * vocabulary is expressed as data ({@link PANEL_NODE_SPECS}) so the
 * dependency-free validator ({@link ../schema/validate-panel}) can enforce it
 * without importing runtime.
 */

/** Wire version of the panel tree envelope. */
export const PANEL_TREE_VERSION = 1 as const;

/** A JSON-safe value: what may appear inside any panel node's `props`. */
export type PanelJsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<PanelJsonValue>
  | { readonly [key: string]: PanelJsonValue };

/**
 * Resource caps for a serialized panel tree. The host and the validator reject
 * a tree that exceeds any of these before it is rendered — a malicious or buggy
 * author cannot exhaust host resources through the panel channel.
 */
export const PANEL_CAPS = {
  /** Max serialized tree size, in bytes (256 KB). */
  treeBytes: 262144,
  /** Max total node count in a tree. */
  nodes: 2000,
  /** Max nesting depth (root = depth 1). */
  depth: 32,
  /** Max length of any string value inside `props`. */
  stringLength: 4096,
  /** Max options on a `selectField` / `toggleGroup` / `menu`. */
  options: 256,
  /** Max stops on a `gradientStops` composite. */
  gradientStops: 64,
  /** Max event names on a single node. */
  eventsPerNode: 8,
  /** Max serialized size of an event intent payload, in bytes (32 KB). */
  intentBytes: 32768,
} as const;

/**
 * The CLOSED set of icon tokens a panel may reference. The host maps each token
 * to a concrete lucide (or letter-glyph) component; authors can never inject
 * SVG or an arbitrary icon name. Derived from the tokens the built-in designer
 * right-panel sections actually use, plus the letter glyphs (`w`, `h`, `a`)
 * rendered as bold letters in dimension/typography inputs and the rotate/flip
 * variants used by the fill and layout controls.
 */
export type IconName =
  | "w"
  | "h"
  | "a"
  | "plus"
  | "minus"
  | "x"
  | "trash"
  | "pencil"
  | "search"
  | "settings"
  | "info"
  | "alert"
  | "image"
  | "imagePlus"
  | "pipette"
  | "percent"
  | "diamond"
  | "square"
  | "squareDashed"
  | "squareRoundCorner"
  | "squareRoundCornerTopLeft"
  | "squareRoundCornerBottomLeft"
  | "squareRoundCornerBottomRight"
  | "squareDashedTopSolid"
  | "squareDashedTopSolidLeft"
  | "squareDashedTopSolidRight"
  | "squareDashedTopSolidBottom"
  | "type"
  | "component"
  | "code"
  | "eye"
  | "paintbrush"
  | "chevronDown"
  | "chevronRight"
  | "chevronUp"
  | "arrowDown"
  | "arrowRight"
  | "arrowUpCircle"
  | "rotateCw"
  | "rotateCcw"
  | "flipHorizontal"
  | "undo"
  | "redo"
  | "save"
  | "fullscreen"
  | "scan"
  | "vault"
  | "panelLeftDashed"
  | "panelRightDashed"
  | "panelTopDashed"
  | "panelBottomDashed"
  | "panelLeftRightDashed"
  | "panelTopBottomDashed"
  | "betweenHorizontalStart"
  | "user"
  | "users"
  | "externalLink"
  | "mousePointer"
  | "alignLeft"
  | "alignCenter"
  | "alignRight";

/** Every icon token as a runtime list; the validator derives its `Set` from it. */
export const PANEL_ICON_NAME_LIST = [
  "w",
  "h",
  "a",
  "plus",
  "minus",
  "x",
  "trash",
  "pencil",
  "search",
  "settings",
  "info",
  "alert",
  "image",
  "imagePlus",
  "pipette",
  "percent",
  "diamond",
  "square",
  "squareDashed",
  "squareRoundCorner",
  "squareRoundCornerTopLeft",
  "squareRoundCornerBottomLeft",
  "squareRoundCornerBottomRight",
  "squareDashedTopSolid",
  "squareDashedTopSolidLeft",
  "squareDashedTopSolidRight",
  "squareDashedTopSolidBottom",
  "type",
  "component",
  "code",
  "eye",
  "paintbrush",
  "chevronDown",
  "chevronRight",
  "chevronUp",
  "arrowDown",
  "arrowRight",
  "arrowUpCircle",
  "rotateCw",
  "rotateCcw",
  "flipHorizontal",
  "undo",
  "redo",
  "save",
  "fullscreen",
  "scan",
  "vault",
  "panelLeftDashed",
  "panelRightDashed",
  "panelTopDashed",
  "panelBottomDashed",
  "panelLeftRightDashed",
  "panelTopBottomDashed",
  "betweenHorizontalStart",
  "user",
  "users",
  "externalLink",
  "mousePointer",
  "alignLeft",
  "alignCenter",
  "alignRight",
] as const satisfies ReadonlyArray<IconName>;

/**
 * The base shape shared by every panel node: a discriminating string `type`, a
 * reconciler instance `id` (a non-negative integer, unique in the tree, stable
 * while the node is mounted), a per-type `props` bag of {@link PanelJsonValue}s,
 * and the `events` present on the node (a subset of the type's event allowlist).
 * Container types add `children`.
 */
export interface PanelNodeBase {
  readonly type: string;
  readonly id: number;
  readonly props: { readonly [key: string]: PanelJsonValue };
  readonly events: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<PanelNode>;
}

// =============================================================================
// Chrome / layout
// =============================================================================

/** Root of a panel. Exactly one per tree; the only valid tree root. */
export interface PanelRootNode extends PanelNodeBase {
  readonly type: "panel";
  readonly children: ReadonlyArray<PanelNode>;
}

/**
 * A titled, host-collapsible section. `sectionActions` header affordances
 * (+/−) live as a child node, not as props.
 */
export interface SectionNode extends PanelNodeBase {
  readonly type: "section";
  readonly children: ReadonlyArray<PanelNode>;
}

/** Slot for a section header's +/− buttons; children are `button`s. */
export interface SectionActionsNode extends PanelNodeBase {
  readonly type: "sectionActions";
  readonly children: ReadonlyArray<PanelNode>;
}

/** A nested grouping inside a `section`. */
export interface SubsectionNode extends PanelNodeBase {
  readonly type: "subsection";
  readonly children: ReadonlyArray<PanelNode>;
}

/** A horizontal flow container. Gap/width come from a small token set. */
export interface RowNode extends PanelNodeBase {
  readonly type: "row";
  readonly children: ReadonlyArray<PanelNode>;
}

/** A vertical flow container. Gap/width come from a small token set. */
export interface ColumnNode extends PanelNodeBase {
  readonly type: "column";
  readonly children: ReadonlyArray<PanelNode>;
}

/** A labeled row: a `label`, an optional leading `icon`, and control children. */
export interface FieldNode extends PanelNodeBase {
  readonly type: "field";
  readonly children: ReadonlyArray<PanelNode>;
}

/** Static text with a small set of `variant` tokens. Childless. */
export interface TextNode extends PanelNodeBase {
  readonly type: "text";
}

/** A message banner with a `tone` token. Childless. */
export interface CalloutNode extends PanelNodeBase {
  readonly type: "callout";
}

/** A host-anchored Radix popover. `open` optional (controlled); `onOpenChange`. */
export interface PopoverNode extends PanelNodeBase {
  readonly type: "popover";
  readonly children: ReadonlyArray<PanelNode>;
}

/** The clickable anchor of a `popover`. */
export interface PopoverTriggerNode extends PanelNodeBase {
  readonly type: "popoverTrigger";
  readonly children: ReadonlyArray<PanelNode>;
}

/** The floating body of a `popover`. */
export interface PopoverContentNode extends PanelNodeBase {
  readonly type: "popoverContent";
  readonly children: ReadonlyArray<PanelNode>;
}

/** A dropdown menu of selectable `items`; fires `onSelect` with the value. */
export interface MenuNode extends PanelNodeBase {
  readonly type: "menu";
}

// =============================================================================
// Controls
// =============================================================================

/**
 * A text / number input. `kind` picks the mode; number kind adds `min`/`max`/
 * `step`. `mixed` renders the multi-selection dash. `onChange` fires live,
 * `onCommit` on blur/enter. An optional `trailingMenu` (line-height Auto/Fixed)
 * fires `onTrailingSelect`.
 */
export interface TextFieldNode extends PanelNodeBase {
  readonly type: "textField";
}

/** A single-select dropdown over `options` (`{value,label,icon?,disabled?}`). */
export interface SelectFieldNode extends PanelNodeBase {
  readonly type: "selectField";
}

/**
 * A segmented control over `options` (`{value,label?,icon?}`); single value.
 * `width: "full"` stretches the control across its container (the default sizes
 * it to its content).
 */
export interface ToggleGroupNode extends PanelNodeBase {
  readonly type: "toggleGroup";
}

/** A boolean switch with optional `label`. */
export interface SwitchFieldNode extends PanelNodeBase {
  readonly type: "switchField";
}

/** A clickable button with `label`/`icon` and `variant`/`size` tokens. */
export interface ButtonNode extends PanelNodeBase {
  readonly type: "button";
}

/** A range slider; `onChange` live, `onCommit` on release. */
export interface SliderFieldNode extends PanelNodeBase {
  readonly type: "sliderField";
}

/** Wraps children with a host reset affordance shown when `show` is true. */
export interface ResetAffordanceNode extends PanelNodeBase {
  readonly type: "resetAffordance";
  readonly children: ReadonlyArray<PanelNode>;
}

// =============================================================================
// Composites (host-integrated designer widgets)
// =============================================================================

/** A color input (host `ColorInput`): value + gesture-aware change events. */
export interface ColorFieldNode extends PanelNodeBase {
  readonly type: "colorField";
}

/** An inline color picker body (host `ColorPickerContent`). */
export interface ColorPickerNode extends PanelNodeBase {
  readonly type: "colorPicker";
}

/** A gradient stop bar (host `GradientStopBar`) over `stops` + `selectedStopId`. */
export interface GradientStopsNode extends PanelNodeBase {
  readonly type: "gradientStops";
}

/** A small color/image preview chip. Childless. */
export interface SwatchNode extends PanelNodeBase {
  readonly type: "swatch";
}

/** An image field; the host owns the asset picker dialog. */
export interface ImageFieldNode extends PanelNodeBase {
  readonly type: "imageField";
}

/** A 3×3 flex alignment grid (host `FlexAlignmentInput`). */
export interface AlignmentGridNode extends PanelNodeBase {
  readonly type: "alignmentGrid";
}

/**
 * A width/height dimension input incl. the fill/hug/custom menu. Mode
 * derivation stays author-side; the wire carries `mode`/`value`/`label`/`mixed`
 * plus events.
 */
export interface DimensionFieldNode extends PanelNodeBase {
  readonly type: "dimensionField";
}

/** The fill row + fill editor popover as one composite (host fill widget). */
export interface FillFieldNode extends PanelNodeBase {
  readonly type: "fillField";
}

/**
 * A variable binding editor (host `VariableInput`). The host emits a single
 * change carrying the new `{type,value}` binding; `onBind`/`onUnbind`/`onCreate`
 * are the addressable intents the host reduces that change to.
 */
export interface VariableFieldNode extends PanelNodeBase {
  readonly type: "variableField";
}

/**
 * An action editor whose `value` is a plain-JSON action object. `variables` /
 * `productVariables` carry the selection-scoped variable lists the editor offers
 * (serializable {@link LabeledVariable}-shaped objects), and `payloadFields`
 * enables "From action payload" value sources when the emitting component action
 * exposes payload fields.
 */
export interface ActionEditorFieldNode extends PanelNodeBase {
  readonly type: "actionEditorField";
}

/**
 * A literal product-value editor (host `ProductInput`): a searchable product
 * combobox that resolves the org's products host-side. `onChange` fires with the
 * picked product id (`""` when cleared). Purpose: editing a `product`-typed
 * variable's literal value, where a raw text field would not resolve a product
 * name.
 */
export interface ProductFieldNode extends PanelNodeBase {
  readonly type: "productField";
}

/**
 * Host-expanded full default row for a single component prop, addressed by
 * `name`. Childless; the host expands it from the component manifest.
 */
export interface PropFieldNode extends PanelNodeBase {
  readonly type: "propField";
}

/**
 * Host-expanded whole auto-generated prop list, minus any names in `exclude`.
 * Childless; the host expands it from the component manifest.
 */
export interface DefaultPropsNode extends PanelNodeBase {
  readonly type: "defaultProps";
}

/** The closed union of every panel node in the v1 vocabulary. */
export type PanelNode =
  | PanelRootNode
  | SectionNode
  | SectionActionsNode
  | SubsectionNode
  | RowNode
  | ColumnNode
  | FieldNode
  | TextNode
  | CalloutNode
  | PopoverNode
  | PopoverTriggerNode
  | PopoverContentNode
  | MenuNode
  | TextFieldNode
  | SelectFieldNode
  | ToggleGroupNode
  | SwitchFieldNode
  | ButtonNode
  | SliderFieldNode
  | ResetAffordanceNode
  | ColorFieldNode
  | ColorPickerNode
  | GradientStopsNode
  | SwatchNode
  | ImageFieldNode
  | AlignmentGridNode
  | DimensionFieldNode
  | FillFieldNode
  | VariableFieldNode
  | ActionEditorFieldNode
  | ProductFieldNode
  | PropFieldNode
  | DefaultPropsNode;

/** A serialized panel tree envelope (what the sandbox posts to the host). */
export interface PanelTree {
  readonly version: typeof PANEL_TREE_VERSION;
  readonly root: PanelRootNode;
}

/**
 * The closed v1 spec for one node type, consumed by the dependency-free
 * validator: which `props` keys are allowed, which `events` names are allowed,
 * and whether the type may carry `children`.
 */
export interface PanelNodeSpec {
  readonly props: ReadonlyArray<string>;
  readonly events: ReadonlyArray<string>;
  readonly children: boolean;
}

/**
 * The single source of truth for the v1 panel vocabulary. Each entry lists the
 * closed set of prop KEYS and event names the node accepts and whether it takes
 * children. Values inside `props` stay loosely typed as {@link PanelJsonValue}
 * on the wire — the host enforces value-level shape when it renders — but the
 * KEYS are closed here and the validator rejects anything outside them.
 *
 * Composite prop keys mirror the serializable subset of the corresponding host
 * component's props (callbacks and ReactNodes are dropped; each callback
 * becomes an entry in `events`).
 */
export const PANEL_NODE_SPECS = {
  // ── Chrome / layout ────────────────────────────────────────────────────────
  panel: {
    props: [],
    events: [],
    children: true,
  },
  section: {
    props: ["title", "collapsible", "defaultCollapsed"],
    events: ["onToggle"],
    children: true,
  },
  sectionActions: {
    props: [],
    events: [],
    children: true,
  },
  subsection: {
    props: ["title"],
    events: [],
    children: true,
  },
  row: {
    props: ["gap", "width", "align", "justify"],
    events: [],
    children: true,
  },
  column: {
    props: ["gap", "width", "align"],
    events: [],
    children: true,
  },
  field: {
    props: ["label", "icon"],
    events: [],
    children: true,
  },
  text: {
    props: ["content", "variant", "tone"],
    events: [],
    children: false,
  },
  callout: {
    props: ["message", "tone"],
    events: [],
    children: false,
  },
  popover: {
    props: ["open"],
    events: ["onOpenChange"],
    children: true,
  },
  popoverTrigger: {
    props: [],
    events: [],
    children: true,
  },
  popoverContent: {
    props: ["align", "side", "title"],
    events: ["onClose"],
    children: true,
  },
  menu: {
    props: ["items", "value", "align", "icon", "label", "variant", "size"],
    events: ["onSelect"],
    children: false,
  },

  // ── Controls ───────────────────────────────────────────────────────────────
  textField: {
    props: [
      "kind",
      "value",
      "mixed",
      "placeholder",
      "min",
      "max",
      "step",
      "icon",
      "disabled",
      "trailingMenu",
    ],
    events: ["onChange", "onCommit", "onTrailingSelect"],
    children: false,
  },
  selectField: {
    props: ["value", "options", "placeholder", "mixed", "disabled", "icon"],
    events: ["onChange"],
    children: false,
  },
  toggleGroup: {
    props: ["value", "options", "mixed", "disabled", "width"],
    events: ["onChange"],
    children: false,
  },
  switchField: {
    props: ["checked", "mixed", "label", "disabled"],
    events: ["onChange"],
    children: false,
  },
  button: {
    props: ["label", "hint", "icon", "variant", "size", "width", "disabled"],
    events: ["onClick"],
    children: false,
  },
  sliderField: {
    props: ["value", "min", "max", "step", "mixed", "disabled"],
    events: ["onChange", "onCommit"],
    children: false,
  },
  resetAffordance: {
    props: ["show", "label"],
    events: ["onReset"],
    children: true,
  },

  // ── Composites ─────────────────────────────────────────────────────────────
  colorField: {
    props: ["value", "mixed", "mixedLabel", "disabled"],
    events: ["onChange", "onDragStart", "onCommit", "onDiscard"],
    children: false,
  },
  colorPicker: {
    props: ["color", "opacity"],
    events: ["onColorChange", "onOpacityChange", "onDragStart", "onDragEnd", "onDiscard"],
    children: false,
  },
  gradientStops: {
    props: ["stops", "selectedStopId"],
    events: [
      "onSelect",
      "onAddStop",
      "onMoveStop",
      "onRemoveStop",
      "onDragStart",
      "onDragEnd",
      "onDiscard",
    ],
    children: false,
  },
  swatch: {
    props: ["color", "imageUrl"],
    events: [],
    children: false,
  },
  imageField: {
    props: ["url", "resizeMode"],
    events: ["onPick", "onResizeModeChange", "onClear"],
    children: false,
  },
  alignmentGrid: {
    props: ["flexDirection", "alignItems", "justifyContent", "mixed"],
    events: ["onChange"],
    children: false,
  },
  dimensionField: {
    props: ["axis", "mode", "value", "label", "mixed", "disabled", "computed"],
    events: ["onChange", "onCommit", "onModeChange"],
    children: false,
  },
  fillField: {
    props: [
      "label",
      "backgroundType",
      "isTypeMixed",
      "backgroundColor",
      "gradient",
      "selectedStopIndex",
      "image",
      "open",
    ],
    events: [
      "onTypeChange",
      "onColorChange",
      "onGradientChange",
      "onStopColorChange",
      "onStopPositionChange",
      "onAddStop",
      "onAddStopAt",
      "onRemoveStop",
      "onSelectStop",
      "onImageUrlChange",
      "onImageResizeModeChange",
      "onGestureStart",
      "onCommit",
      "onDiscard",
      "onOpenChange",
    ],
    children: false,
  },
  variableField: {
    props: ["variableId", "variableName", "variableType", "allowedKinds", "label"],
    events: ["onBind", "onUnbind", "onCreate"],
    children: false,
  },
  actionEditorField: {
    props: ["value", "variables", "productVariables", "payloadFields"],
    events: ["onChange"],
    children: false,
  },
  productField: {
    props: ["productId", "placeholder", "disabled", "label"],
    events: ["onChange"],
    children: false,
  },
  propField: {
    props: ["name"],
    events: [],
    children: false,
  },
  defaultProps: {
    props: ["exclude"],
    events: [],
    children: false,
  },
} as const satisfies Record<string, PanelNodeSpec>;

/** The literal union of every valid node `type`. */
export type PanelNodeType = keyof typeof PANEL_NODE_SPECS;
