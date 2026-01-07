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
// Canvas Commands
// =============================================================================

export {
  saveCanvasState,
  updateBoundingBox,
  nodeMouseEnter,
  nodeMouseOver,
  nodeMouseLeave,
  nodeClicked,
  textEditingStarted,
  textEditingStopped,
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

// =============================================================================
// Debug Commands
// =============================================================================

export { setShowGrid, toggleShowGrid } from "./debug-actions";

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

// =============================================================================
// Flex Node Commands
// =============================================================================

export {
  createFlexNode,
  updateFlexNode,
  addFlexNodeVariable,
  removeFlexNodeVariable,
  updateFlexNodeVariable,
  addFlexNodeState,
  removeFlexNodeState,
  updateFlexNodeState,
} from "./nodes/flex-node-actions";

// =============================================================================
// Screen Node Commands
// =============================================================================

export {
  createScreenNode,
  updateScreenNode,
  addScreenNodeVariable,
  removeScreenNodeVariable,
  updateScreenNodeVariable,
  addScreenNodeState,
  removeScreenNodeState,
  updateScreenNodeState,
} from "./nodes/screen-node-actions";

// =============================================================================
// Text Node Commands
// =============================================================================

export {
  createTextNode,
  updateTextNode,
  addTextNodeVariable,
  removeTextNodeVariable,
  updateTextNodeVariable,
  addTextNodeState,
  removeTextNodeState,
  updateTextNodeState,
} from "./nodes/text-node-actions";

// =============================================================================
// Core Utilities
// =============================================================================

export { variableTypeKeySchema, type VariableTypeKey } from "./core";
