/**
 * The intrinsic element names the panel reconciler understands — one per
 * authorable {@link PanelNodeType}. Each `Panel.*` primitive lowers to the
 * matching `vh-panel-*` intrinsic (mirroring how the preview tree host lowers
 * to `vh-view`, `vh-text`, … in `tree-renderer/tree-host.ts`); the serializer
 * maps the intrinsic back to its wire node `type`.
 */
import type { PanelNodeType } from "../schema/panel-tree";

/** Wire node type → intrinsic element name. */
export const PANEL_ELEMENT_TYPES = {
  panel: "vh-panel",
  section: "vh-panel-section",
  sectionActions: "vh-panel-section-actions",
  subsection: "vh-panel-subsection",
  row: "vh-panel-row",
  column: "vh-panel-column",
  field: "vh-panel-field",
  text: "vh-panel-text",
  callout: "vh-panel-callout",
  popover: "vh-panel-popover",
  popoverTrigger: "vh-panel-popover-trigger",
  popoverContent: "vh-panel-popover-content",
  menu: "vh-panel-menu",
  textField: "vh-panel-text-field",
  selectField: "vh-panel-select-field",
  toggleGroup: "vh-panel-toggle-group",
  switchField: "vh-panel-switch-field",
  button: "vh-panel-button",
  sliderField: "vh-panel-slider-field",
  resetAffordance: "vh-panel-reset-affordance",
  colorField: "vh-panel-color-field",
  colorPicker: "vh-panel-color-picker",
  gradientStops: "vh-panel-gradient-stops",
  swatch: "vh-panel-swatch",
  imageField: "vh-panel-image-field",
  alignmentGrid: "vh-panel-alignment-grid",
  dimensionField: "vh-panel-dimension-field",
  fillField: "vh-panel-fill-field",
  variableField: "vh-panel-variable-field",
  actionEditorField: "vh-panel-action-editor-field",
  productField: "vh-panel-product-field",
  propField: "vh-panel-prop-field",
  defaultProps: "vh-panel-default-props",
} as const satisfies Record<PanelNodeType, string>;

/** Intrinsic element name → wire node type, derived from {@link PANEL_ELEMENT_TYPES}. */
export const PANEL_ELEMENT_TO_TYPE: Readonly<Record<string, PanelNodeType>> = Object.fromEntries(
  Object.entries(PANEL_ELEMENT_TYPES).map(([type, element]) => [element, type as PanelNodeType]),
);
