/**
 * `@voidhash/paywalls/panel` — the editor-panel authoring surface and reconciler.
 *
 * A panel definition is `(ctx: PanelContext) => ReactNode` built from the
 * `Panel.*` primitives. A {@link createPanelSession} mounts it with a custom
 * `react-reconciler` host that serializes each commit into the closed
 * {@link PanelTree} wire format — functions never cross the boundary; fired
 * events are addressed by `(nodeId, eventName)` and routed back through
 * {@link PanelSession.dispatchEvent}. Author `ctx.props.*` writes emit
 * {@link PanelIntent}s the host reduces.
 *
 * Built-in designer panels run a session in-process; code-component panels run
 * one inside the sandbox iframe.
 */
export type {
  PanelContext,
  PanelData,
  PanelGesture,
  PanelProps,
  PanelPropHandle,
  PanelReadonlyPropHandle,
  PanelRefPropHandle,
  PanelSelection,
  PanelSetOptions,
} from "./context";
export type {
  GestureCommitIntent,
  GestureDiscardIntent,
  PanelIntent,
  ResetPropIntent,
  SetPropIntent,
  SetRefIntent,
} from "./intent";
export { PANEL_ELEMENT_TO_TYPE, PANEL_ELEMENT_TYPES } from "./intrinsics";
export {
  Panel,
  type PanelActionEditorFieldProps,
  type PanelAlignmentGridProps,
  type PanelButtonProps,
  type PanelCalloutProps,
  type PanelColorFieldProps,
  type PanelColorPickerProps,
  type PanelColumnProps,
  type PanelDefaultPropsProps,
  type PanelDimensionFieldProps,
  type PanelFieldProps,
  type PanelFillFieldProps,
  type PanelGradientStopsProps,
  type PanelImageFieldProps,
  type PanelMenuProps,
  type PanelOption,
  type PanelPopoverContentProps,
  type PanelPopoverProps,
  type PanelPopoverTriggerProps,
  type PanelProductFieldProps,
  type PanelPropFieldProps,
  type PanelResetAffordanceProps,
  type PanelRootProps,
  type PanelRowProps,
  type PanelSectionActionsProps,
  type PanelSectionProps,
  type PanelSelectFieldProps,
  type PanelSliderFieldProps,
  type PanelSubsectionProps,
  type PanelSwatchProps,
  type PanelSwitchFieldProps,
  type PanelTextFieldProps,
  type PanelTextProps,
  type PanelToggleGroupProps,
  type PanelTrailingMenu,
  type PanelVariableFieldProps,
} from "./primitives";
export { PanelRuntimeProvider, type PanelRuntimeProviderProps, usePanelContext } from "./runtime";
export {
  type CreatePanelSessionOptions,
  createPanelSession,
  type PanelPropInput,
  type PanelSession,
  type PanelSessionCallbacks,
  type PanelSessionInputs,
} from "./session";
