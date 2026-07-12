// Types
export type {
  CodeComponentSnapshotNode,
  ComponentSnapshotNode,
  LibrarySnapshotNode,
  NodeType,
  PathSnapshotNode,
  RenderOptions,
  RenderResult,
  RootSnapshotNode,
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  ShapeSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "./types";

// Style builders
export {
  buildBackgroundStyles,
  buildPathStyles,
  buildPreviewBackgroundStyles,
  buildScreenContainerStyles,
  buildScreenLayoutStyles,
  buildScrollViewStyles,
  buildShapeContainerStyles,
  buildTextStyles,
  buildViewStyles,
  type BackgroundStyleInput,
  type PathSvgAttributes,
  type PreviewBackgroundStyleInput,
  type ScrollViewOptions,
  type ViewStyleInput,
} from "./styles";

// Utilities
export { px, pxOrAuto } from "./styles/utils";

// Snapshot types
export type {
  Action,
  ActionValueSource,
  ComponentActionValueSource,
  ComponentBoundAction,
  ComponentProductSource,
  ComponentPropBinding,
  ComponentPropValue,
  DNF,
  Interaction,
  NodeState,
  ProductSource,
  VariableValue,
} from "./snapshot-types";

// Variables
export {
  collectVariables,
  collectVariableScopes,
  createChainVariableReader,
  findDeclaringNodeInChain,
  type NodeVariableMap,
  type VariableAliases,
  type VariableCollection,
  type VariableReader,
  type VariableScopes,
  type VariableStore,
} from "./variables";

// Evaluator
export { evaluateDNF } from "./evaluator";

// State resolver
export { resolveActionOverride, resolveStyle } from "./state-resolver";

// Actions
export { executeAction, executeComponentBoundAction, type ActionCallbacks } from "./actions";

// Preview trees
export {
  buildPreviewNodeStyles,
  buildPreviewMotionStyles,
  previewResizeModeToObjectFit,
  type PreviewImageNode,
  type PreviewNode,
  type PreviewNodeStyle,
  type PreviewResolvedMotionStyle,
  type PreviewPlaceholderNode,
  type PreviewPressableNode,
  type PreviewResizeMode,
  type PreviewScrollNode,
  type PreviewSlotNode,
  type PreviewStyleValue,
  type PreviewTextNode,
  type PreviewTree,
  type PreviewViewNode,
  type StyledPreviewNodeType,
} from "./preview-tree";

// Messages
export { isPaywallMessage, type PaywallMessage } from "./messages";
