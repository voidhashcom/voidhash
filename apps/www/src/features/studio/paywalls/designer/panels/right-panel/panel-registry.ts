import type { PanelRender } from "../../panel-runtime/in-process-transport";
import type { EditableNodeType } from "../types";
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
 * The engine and payload backing a registered panel. Built-in panels run trusted
 * definitions in process; component panels run authored code in the sandbox.
 */
export type PanelSourceSpec =
  | {
      readonly kind: "builtin";
      /** The panel definition `(ctx) => ReactNode`. */
      readonly definition: PanelRender;
    }
  | { readonly kind: "component-panel" };

/** Stable identifiers for panels in the right-panel registry. */
export type PanelId =
  | "variables"
  | "states"
  | "position"
  | "flexLayout"
  | "shapeLayout"
  | "borderRadius"
  | "fill"
  | "border"
  | "interactions"
  | "scrollViewSettings"
  | "typography"
  | "textFill"
  | "pathFill"
  | "pathStroke"
  | "componentSettings"
  | "componentProps"
  | "componentActions";

/**
 * A registered right-panel entry and its applicability and rendering source.
 */
export interface PanelRegistryEntry {
  readonly id: PanelId;
  readonly supportedNodeTypes: EditableNodeType[];
  readonly order: number;
  readonly multiSelectable: boolean;
  readonly source: PanelSourceSpec;
}

/**
 * The right-panel registry. Every entry uses a built-in definition except
 * `componentProps`, whose editor is authored as a code component.
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
    // The component panel batch-edits homogeneous selections sharing an identity.
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
 * Returns registered panels applicable to the given node types. A panel is
 * included only when all node types are supported; when `isMulti`, panels with
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
