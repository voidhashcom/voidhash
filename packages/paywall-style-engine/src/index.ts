export {
  acceptanceOf,
  expectedTypeLabel,
  nodeDefaultStyle,
  nodeStyleFields,
  nodeStyleSchema,
  styleFieldSchema,
  unwrapEntriesDeep,
  type Acceptance,
  type FieldsSchema,
  type SerializedSchema,
  type SerializedValidator,
} from "./introspection.ts";

export {
  errorDiagnostic,
  warningDiagnostic,
  type StyleDiagnostic,
  type StyleDiagnosticCode,
} from "./diagnostics.ts";

export {
  deriveAxisSizing,
  fixedAlignSelf,
  hugAlignSelf,
  sizingModePatch,
  stretchDirectionFor,
  type AxisSizing,
  type DimensionAxis,
  type ParentFlexContext,
  type SizingMode,
  type StylePatch,
  type StyleTargetView,
} from "./model.ts";

export { validateStylePatch } from "./validate.ts";

export {
  normalizeStylePatch,
  repairFlexSizing,
  withDerivedEnabledFlags,
  STYLE_GROUP_FLAG_BY_FIELD,
} from "./normalize.ts";

export {
  nodeCapabilities,
  selectionCapabilities,
  type AlignmentControlMode,
  type Availability,
  type AxisCapability,
  type CapabilityReason,
  type ContainerCapability,
  type NodeStyleCapabilities,
  type SelectionAxisCapability,
  type SelectionCapabilities,
} from "./capabilities.ts";

export {
  collapseContainerStretch,
  expandContainerStretch,
  type ContainerStretchPlan,
  type StretchChildView,
} from "./virtual-stretch.ts";

export {
  planStyleEdit,
  type ComputedSizes,
  type NodeWritePlan,
  type PlanOptions,
  type StyleEditOp,
  type StyleWritePlan,
  type WriteDiscipline,
} from "./plan.ts";

export {
  buildBackgroundStyles,
  buildPreviewBackgroundStyles,
  type BackgroundStyleInput,
  type PreviewBackgroundStyleInput,
} from "./compile/background.ts";
export { buildViewStyles, type ViewStyleInput } from "./compile/view-styles.ts";
export { buildTextStyles } from "./compile/text-styles.ts";
export { buildScreenContainerStyles, buildScreenLayoutStyles } from "./compile/screen-styles.ts";
export { buildScrollViewStyles, type ScrollViewOptions } from "./compile/scroll-view-styles.ts";
export { buildShapeContainerStyles } from "./compile/shape-styles.ts";
export { buildPathStyles, type PathSvgAttributes } from "./compile/path-styles.ts";
export { px, pxOrAuto } from "./compile/utils.ts";
export {
  compileBoxStyles,
  compileScreenStyles,
  type CompileBoxRequest,
  type CompiledScreenStyles,
  type CompileTarget,
} from "./compile/compile.ts";
