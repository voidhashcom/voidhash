/**
 * Designer store commands.
 *
 * This module re-exports all commands for the paywall designer.
 * Commands are defined using the zustand-commander pattern.
 */

// =============================================================================
// Selection Commands
// =============================================================================

export { selectNode, unselectNode, clearSelection } from "./selection-actions";

// =============================================================================
// Drag Select Commands
// =============================================================================

export {
  startDragSelect,
  updateDragSelect,
  endDragSelect,
  cancelDragSelect,
} from "./drag-select-actions";

// =============================================================================
// Resize Commands
// =============================================================================

export { startResize, updateResize, endResize, cancelResize } from "./resize-actions";

// =============================================================================
// Move Commands (canvas drag-to-move for absolutely positioned view nodes)
// =============================================================================

export { startMove, updateMove, endMove, cancelMove } from "./move-actions";

// =============================================================================
// Canvas Commands
// =============================================================================

export {
  saveCanvasState,
  updateBoundingBox,
  updateBoundingBoxes,
  nodeMouseEnter,
  nodeMouseOver,
  nodeMouseLeave,
  nodeClicked,
  nodeDoubleClicked,
  textEditingStarted,
  textEditingStopped,
  clearHighlight,
  setHighlightedNode,
} from "./canvas-actions";

// =============================================================================
// Tool Commands
// =============================================================================

export { setActiveTool } from "./tools-actions";

// =============================================================================
// Mode Commands
// =============================================================================

export { setMode, setPreviewScale } from "./mode-actions";

// =============================================================================
// Panel Commands
// =============================================================================

export {
  setTopPanelHeight,
  setBottomPanelHeight,
  setLeftPanelWidth,
  setRightPanelWidth,
} from "./panel-actions";
export { setStateOverrideSelection } from "./state-override-selection-actions";
export { setActiveLocale } from "./active-locale-actions";
export { setComponentPreviewStateSelection } from "./component-preview-state-selection-actions";
export {
  mergeComponentCatalogVersions,
  setComponentCatalogComponents,
} from "./component-catalog-actions";

// =============================================================================
// Debug Commands
// =============================================================================

export { setShowGrid, toggleShowGrid } from "./debug-actions";

// =============================================================================
// AI Panel Commands
// =============================================================================

export { setAiPanelWidth, toggleAiPanel } from "./ai-panel-actions";

// =============================================================================
// Awareness Commands
// =============================================================================

export { updateCursor, updateUser } from "./awareness-actions";

// =============================================================================
// Layer Commands
// =============================================================================

export { moveNode, moveNodeBefore, moveNodeAfter } from "./layer-actions";

// =============================================================================
// Node Commands (CRUD)
// =============================================================================

export { deleteNodes, copyNodes, cutNodes, pasteNodes } from "./node-actions";
export { applyDocumentEdits, type ApplyDocumentEditsResult } from "./document-edit-actions";

// =============================================================================
// View Node Commands
// =============================================================================

export { createViewNode, updateViewNode } from "./nodes/view-node-actions";

// =============================================================================
// ScrollView Node Commands
// =============================================================================

export { createScrollViewNode, updateScrollViewNode } from "./nodes/scrollview-node-actions";

// =============================================================================
// Screen Node Commands
// =============================================================================

export { createScreenNode, updateScreenNode } from "./nodes/screen-node-actions";

// =============================================================================
// Text Node Commands
// =============================================================================

export { createTextNode, updateTextNode } from "./nodes/text-node-actions";

// =============================================================================
// Shape Node Commands
// =============================================================================

export { createShapeFromSvg, createShapeNode, updateShapeNode } from "./nodes/shape-node-actions";

// =============================================================================
// Path Node Commands
// =============================================================================

export { createPathNode, updatePathNode } from "./nodes/path-node-actions";

// =============================================================================
// Component Node Commands
// =============================================================================

export {
  insertBuiltinComponentNode,
  insertComponentNode,
  insertLocalComponentNode,
  repairLocalComponentReference,
  updateComponentNode,
} from "./nodes/component-node-actions";

export {
  applyComponentVersionUpdate,
  removeComponentActionBinding,
  removeComponentProp,
  removeComponentPropForNodes,
  setComponentActionBinding,
  updateComponentPropBinding,
  updateComponentPropBindingForNodes,
} from "./features/component-prop-actions";

// =============================================================================
// Code Component Commands (paywall-scoped, source in the mimic doc)
// =============================================================================

export {
  createCodeComponent,
  deleteCodeComponent,
  renameComponentFile,
  saveCodeComponentSource,
} from "./code-component-actions";

export {
  closeTab,
  openTab,
  pruneCodeComponentsCompiled,
  setCodeComponentCompiled,
  setCodeComponentDirty,
  setCodeEditorPreviewState,
} from "./code-component-editor-actions";

// =============================================================================
// Feature Actions (type-safe, node-type-agnostic)
// =============================================================================

export { addVariable, removeVariable, updateVariable } from "./features/variable-actions";

export { addNodeState, removeNodeState, updateNodeState } from "./features/state-actions";

export {
  addLocale,
  clearLocale,
  copyLocaleFrom,
  removeLocale,
  setDefaultLocale,
  updateComponentPropLocalizedValue,
  updateNodeLocalizedImage,
  updateNodeTranslation,
} from "./features/locale-actions";

export {
  addInteraction,
  removeInteraction,
  updateInteraction,
  updateInteractionActionOverride,
} from "./features/interaction-actions";

export { updateFillStyle } from "./features/fill-style-actions";
export { updateTextFillStyle } from "./features/text-fill-style-actions";
export { updateTypographyStyle } from "./features/typography-style-actions";
export { updateBorderStyle } from "./features/border-style-actions";
export { updateBorderRadiusStyle } from "./features/border-radius-style-actions";
export { updateLayoutStyle, applyPerNodeLayoutStyle } from "./features/layout-style-actions";
export type { PerNodeLayoutStyle } from "./features/layout-style-actions";
export { updatePathFillStyle } from "./features/path-fill-style-actions";
export { updatePathStrokeStyle } from "./features/path-stroke-style-actions";

// =============================================================================
// Node Resolver
// =============================================================================

export {
  isEditableNodeType,
  isStatefulNodeType,
  getNodePrimitive,
  getStatefulNodePrimitive,
  NODE_PRIMITIVES,
  type EditableNodeType,
  type StatefulEditableNodeType,
} from "./node-resolver";

// =============================================================================
// Core Utilities
// =============================================================================

export { variableTypeKeySchema, type VariableTypeKey } from "./core";
