import type { PanelRender, PanelWrap } from "../../panel-runtime/in-process-transport";
import type { EditableNodeType, SectionId } from "../types";
import { BorderPanel } from "./definitions/border-panel";
import { BorderRadiusPanel } from "./definitions/border-radius-panel";
import { ComponentActionsPanel } from "./definitions/component-actions-panel";
import { ComponentSettingsPanel } from "./definitions/component-settings-panel";
import { FillPanel } from "./definitions/fill-panel";
import { FlexLayoutPanel } from "./definitions/flex-layout-panel";
import { PathFillPanel } from "./definitions/path-fill-panel";
import { PathStrokePanel } from "./definitions/path-stroke-panel";
import { PositionPanel } from "./definitions/position-panel";
import { InteractionsPanel } from "./definitions/interactions-panel";
import { ScrollViewSettingsPanel } from "./definitions/scroll-view-settings-panel";
import { ShapeLayoutPanel } from "./definitions/shape-layout-panel";
import { StatesPanel } from "./definitions/states-panel";
import { TextFillPanel } from "./definitions/text-fill-panel";
import { TypographyPanel } from "./definitions/typography-panel";
import { VariablesPanel } from "./definitions/variables-panel";

/**
 * The engine + payload that backs one registered panel. A `builtin` panel runs a
 * trusted definition in-process; its `definition` is OPTIONAL now (Phase 2 fills
 * one per migrated section — until then the entry falls back to the old section
 * component). A `component-panel` panel is authored as a code component and runs
 * in the Phase 3 sandbox.
 */
export type PanelSourceSpec =
  | {
      readonly kind: "builtin";
      /** The panel definition `(ctx) => ReactNode` (filled per section in Phase 2). */
      readonly definition?: PanelRender;
      /** Optional provider re-wrap inside the reconciler root (rarely per-section). */
      readonly wrap?: PanelWrap;
    }
  | { readonly kind: "component-panel" };

/**
 * A registered right-panel entry. Mirrors {@link SectionRegistryEntry} 1:1
 * (id/supportedNodeTypes/order/multiSelectable — same applicability semantics)
 * and adds the {@link PanelSourceSpec} that decides how the panel is rendered
 * behind the v2 flag. When the flag is off, {@link ../dynamic-panel.DynamicPanel}
 * renders the legacy section instead and this registry is unused.
 */
export interface PanelRegistryEntry {
  readonly id: SectionId;
  readonly supportedNodeTypes: EditableNodeType[];
  readonly order: number;
  readonly multiSelectable: boolean;
  readonly source: PanelSourceSpec;
}

/**
 * The right-panel registry. Entries are copied VERBATIM from
 * `section-registry.ts` (ids/order/supportedNodeTypes/multiSelectable) so
 * applicability is byte-identical; only the `source` field is new. Every entry
 * is `builtin` (with an as-yet-empty `definition`) except `componentProps`,
 * which is a `component-panel` (its editor is authored as a code component).
 */
export const PANEL_REGISTRY: PanelRegistryEntry[] = [
  {
    id: "variables",
    supportedNodeTypes: ["screen", "view", "scrollView", "text", "shape", "path"],
    order: 0,
    multiSelectable: false,
    source: { kind: "builtin", definition: VariablesPanel },
  },
  {
    id: "states",
    supportedNodeTypes: ["screen", "view", "scrollView", "text", "shape", "path"],
    order: 1,
    multiSelectable: false,
    source: { kind: "builtin", definition: StatesPanel },
  },
  {
    id: "scrollViewSettings",
    supportedNodeTypes: ["scrollView"],
    order: 2,
    multiSelectable: true,
    source: { kind: "builtin", definition: ScrollViewSettingsPanel },
  },
  {
    id: "position",
    supportedNodeTypes: ["view", "scrollView", "text"],
    order: 2,
    multiSelectable: true,
    source: { kind: "builtin", definition: PositionPanel },
  },
  {
    id: "flexLayout",
    supportedNodeTypes: ["screen", "view", "scrollView"],
    order: 3,
    multiSelectable: true,
    source: { kind: "builtin", definition: FlexLayoutPanel },
  },
  {
    id: "shapeLayout",
    supportedNodeTypes: ["shape"],
    order: 3,
    multiSelectable: false,
    source: { kind: "builtin", definition: ShapeLayoutPanel },
  },
  {
    id: "borderRadius",
    supportedNodeTypes: ["view", "scrollView"],
    order: 4,
    multiSelectable: true,
    source: { kind: "builtin", definition: BorderRadiusPanel },
  },
  {
    id: "fill",
    supportedNodeTypes: ["screen", "view", "scrollView"],
    order: 5,
    multiSelectable: true,
    source: { kind: "builtin", definition: FillPanel },
  },
  {
    id: "border",
    supportedNodeTypes: ["view", "scrollView"],
    order: 6,
    multiSelectable: true,
    source: { kind: "builtin", definition: BorderPanel },
  },
  {
    id: "interactions",
    supportedNodeTypes: ["view", "scrollView"],
    order: 7,
    multiSelectable: true,
    source: { kind: "builtin", definition: InteractionsPanel },
  },
  {
    id: "typography",
    supportedNodeTypes: ["text"],
    order: 8,
    multiSelectable: true,
    source: { kind: "builtin", definition: TypographyPanel },
  },
  {
    id: "textFill",
    supportedNodeTypes: ["text"],
    order: 9,
    multiSelectable: true,
    source: { kind: "builtin", definition: TextFillPanel },
  },
  {
    id: "pathFill",
    supportedNodeTypes: ["path"],
    order: 10,
    multiSelectable: true,
    source: { kind: "builtin", definition: PathFillPanel },
  },
  {
    id: "pathStroke",
    supportedNodeTypes: ["path"],
    order: 11,
    multiSelectable: true,
    source: { kind: "builtin", definition: PathStrokePanel },
  },
  {
    id: "componentSettings",
    supportedNodeTypes: ["component"],
    order: 12,
    multiSelectable: false,
    source: { kind: "builtin", definition: ComponentSettingsPanel },
  },
  {
    id: "componentProps",
    supportedNodeTypes: ["component"],
    order: 13,
    // Phase 3b: the component-panel slot batch-edits a homogeneous multi-selection
    // of the same component (same identity key), so it participates in multi-select.
    multiSelectable: true,
    source: { kind: "component-panel" },
  },
  {
    id: "componentActions",
    supportedNodeTypes: ["component"],
    order: 14,
    multiSelectable: false,
    source: { kind: "builtin", definition: ComponentActionsPanel },
  },
];

/**
 * The set of sections whose built-in `definition` is ready to render through the
 * v2 host. Phase 2 is COMPLETE: this holds every built-in section (all but
 * `componentProps`, the Phase 3 component-panel slot). When the flag is on, the
 * stack renders each through {@link ../builtin-panel-host.BuiltinPanelHost}
 * instead of the legacy section.
 */
export const MIGRATED: ReadonlySet<SectionId> = new Set<SectionId>([
  "borderRadius",
  "border",
  "typography",
  "pathFill",
  "pathStroke",
  "textFill",
  "position",
  "flexLayout",
  "shapeLayout",
  "fill",
  "states",
  "variables",
  "interactions",
  "scrollViewSettings",
  "componentSettings",
  "componentActions",
]);

/**
 * Returns the registered panels applicable to the given node types, mirroring
 * `getSharedSections` exactly: a panel is included only when ALL node types are
 * in its `supportedNodeTypes` ("every", not "any"); when `isMulti`, panels with
 * `multiSelectable: false` are excluded. Results are sorted by `order`.
 */
export function getSharedPanels(
  nodeTypes: EditableNodeType[],
  isMulti: boolean,
): PanelRegistryEntry[] {
  return PANEL_REGISTRY.filter((entry) => {
    if (isMulti && !entry.multiSelectable) return false;
    return nodeTypes.every((t) => entry.supportedNodeTypes.includes(t));
  }).sort((a, b) => a.order - b.order);
}
