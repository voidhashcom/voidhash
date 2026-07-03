/**
 * `Panel.*` — the thin, typed author-facing components for building an editor
 * panel. Each one lowers to a `vh-panel-*` intrinsic the panel reconciler
 * serializes into a {@link PanelNode}. Data props are typed from the wire
 * contract ({@link PANEL_NODE_SPECS}); event props are typed callbacks whose
 * names must be in the node type's event allowlist — the serializer records
 * each present function prop's name into the node's `events`.
 *
 * These render nothing themselves: `createElement(intrinsic, props, children)`
 * hands the props straight to the reconciler, which owns serialization. Text
 * for `Panel.Text`/`Panel.Callout` is authored via the `content`/`message`
 * prop (not JSX children) per the wire contract.
 */
import { createElement, type ReactNode } from "react";

import type { IconName, PanelJsonValue } from "../schema/panel-tree";
import { PANEL_ELEMENT_TYPES } from "./intrinsics";

// ── Shared value vocabularies (mirror the host component prop unions) ─────────

type GapToken = "none" | "xs" | "sm" | "md" | "lg";
type WidthToken = "auto" | "full" | "half";
type AlignToken = "start" | "center" | "end" | "stretch";
type JustifyToken = "start" | "center" | "end" | "between";
type TextVariant = "label" | "body" | "caption" | "heading";
type Tone = "default" | "muted" | "info" | "warning" | "error";
type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "icon-sm" | "default";

/** A `{ value, label?, icon?, disabled? }` option for selects/toggles/menus. */
export interface PanelOption {
  readonly value: string;
  readonly label?: string;
  readonly icon?: IconName;
  readonly disabled?: boolean;
}

/**
 * A `textField.trailingMenu` value: the trailing dropdown's `items` plus an
 * optional currently-selected `value`. This is the wire shape the serializer and
 * host both use (the `Auto`/`Fixed` line-height toggle is the first real use).
 */
export interface PanelTrailingMenu {
  readonly items: ReadonlyArray<PanelOption>;
  readonly value?: string;
}

/** Common children container prop. */
interface WithChildren {
  children?: ReactNode;
}

// ── Chrome / layout ──────────────────────────────────────────────────────────

export interface PanelRootProps extends WithChildren {}
export interface PanelSectionProps extends WithChildren {
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}
export interface PanelSectionActionsProps extends WithChildren {}
export interface PanelSubsectionProps extends WithChildren {
  title?: string;
}
export interface PanelRowProps extends WithChildren {
  gap?: GapToken;
  width?: WidthToken;
  align?: AlignToken;
  justify?: JustifyToken;
}
export interface PanelColumnProps extends WithChildren {
  gap?: GapToken;
  width?: WidthToken;
  align?: AlignToken;
}
export interface PanelFieldProps extends WithChildren {
  label?: string;
  icon?: IconName;
}
export interface PanelTextProps {
  content?: string;
  variant?: TextVariant;
  tone?: Tone;
}
export interface PanelCalloutProps {
  message?: string;
  tone?: Tone;
}
export interface PanelPopoverProps extends WithChildren {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export interface PanelPopoverTriggerProps extends WithChildren {}
export interface PanelPopoverContentProps extends WithChildren {
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}
export interface PanelMenuProps {
  items?: ReadonlyArray<PanelOption>;
  value?: string;
  align?: "start" | "center" | "end";
  onSelect?: (value: string) => void;
}

// ── Controls ─────────────────────────────────────────────────────────────────

export interface PanelTextFieldProps {
  kind?: "text" | "number";
  value?: string | number;
  mixed?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  icon?: IconName;
  disabled?: boolean;
  trailingMenu?: PanelTrailingMenu;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  onTrailingSelect?: (value: string) => void;
}
export interface PanelSelectFieldProps {
  value?: string;
  options?: ReadonlyArray<PanelOption>;
  placeholder?: string;
  mixed?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}
export interface PanelToggleGroupProps {
  value?: string;
  options?: ReadonlyArray<PanelOption>;
  mixed?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}
export interface PanelSwitchFieldProps {
  checked?: boolean;
  mixed?: boolean;
  label?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}
export interface PanelButtonProps {
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
}
export interface PanelSliderFieldProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  mixed?: boolean;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
}
export interface PanelResetAffordanceProps extends WithChildren {
  show?: boolean;
  label?: string;
  onReset?: () => void;
}

// ── Composites ───────────────────────────────────────────────────────────────

export interface PanelColorFieldProps {
  value?: string;
  mixed?: boolean;
  mixedLabel?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onDragStart?: () => void;
  onCommit?: (value: string) => void;
  onDiscard?: () => void;
}
export interface PanelColorPickerProps {
  color?: string;
  opacity?: number;
  onColorChange?: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDiscard?: () => void;
}
export interface PanelGradientStopsProps {
  stops?: PanelJsonValue;
  selectedStopId?: string;
  onSelect?: (stopId: string) => void;
  onAddStop?: (position: number) => void;
  onMoveStop?: (stopId: string, position: number) => void;
  onRemoveStop?: (stopId: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDiscard?: () => void;
}
export interface PanelSwatchProps {
  color?: string;
  imageUrl?: string;
}
export interface PanelImageFieldProps {
  url?: string;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onPick?: () => void;
  onResizeModeChange?: (mode: string) => void;
  onClear?: () => void;
}
export interface PanelAlignmentGridProps {
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  mixed?: boolean;
  onChange?: (value: PanelJsonValue) => void;
}
export interface PanelDimensionFieldProps {
  axis?: "width" | "height";
  mode?: string;
  value?: number;
  label?: string;
  mixed?: boolean;
  disabled?: boolean;
  computed?: number;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
  onModeChange?: (mode: string) => void;
}
export interface PanelFillFieldProps {
  label?: string;
  backgroundType?: string;
  isTypeMixed?: boolean;
  backgroundColor?: string;
  gradient?: PanelJsonValue;
  selectedStopIndex?: number;
  image?: PanelJsonValue;
  open?: boolean;
  onTypeChange?: (type: string) => void;
  onColorChange?: (color: string) => void;
  onGradientChange?: (gradient: PanelJsonValue) => void;
  onStopColorChange?: (index: number, color: string) => void;
  onStopPositionChange?: (index: number, position: number) => void;
  onAddStop?: () => void;
  onAddStopAt?: (position: number) => void;
  onRemoveStop?: (index: number) => void;
  onSelectStop?: (index: number) => void;
  onImageUrlChange?: (url: string) => void;
  onImageResizeModeChange?: (mode: string) => void;
  onGestureStart?: () => void;
  onCommit?: () => void;
  onDiscard?: () => void;
  onOpenChange?: (open: boolean) => void;
}
export interface PanelVariableFieldProps {
  variableId?: string;
  variableName?: string;
  variableType?: string;
  allowedKinds?: ReadonlyArray<string>;
  label?: string;
  onBind?: (variableId: string) => void;
  onUnbind?: () => void;
  onCreate?: (name: string) => void;
}
export interface PanelActionEditorFieldProps {
  value?: PanelJsonValue;
  /** Serializable variable list offered to set-variable targets and value pickers. */
  variables?: PanelJsonValue;
  /** Product-typed subset of `variables`, offered to purchase-product. */
  productVariables?: PanelJsonValue;
  /** Payload field names of the emitting component action (enables "From action payload"). */
  payloadFields?: ReadonlyArray<string>;
  onChange?: (value: PanelJsonValue) => void;
}
export interface PanelProductFieldProps {
  productId?: string;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  onChange?: (productId: string) => void;
}
export interface PanelPropFieldProps {
  name: string;
}
export interface PanelDefaultPropsProps {
  exclude?: ReadonlyArray<string>;
}

// ── Component factory ────────────────────────────────────────────────────────

/** Builds a thin primitive lowering to `intrinsic`, with a stable displayName. */
const primitive = <P extends object>(intrinsic: string, displayName: string) => {
  const Component = (props: P): ReactNode => {
    const { children, ...rest } = props as P & { children?: ReactNode };
    return createElement(intrinsic, rest, children);
  };
  Component.displayName = displayName;
  return Component;
};

const PanelRoot = primitive<PanelRootProps>(PANEL_ELEMENT_TYPES.panel, "Panel");

/**
 * Root of a component's custom editor panel. Compose the `Panel.*` children to
 * describe the panel; the reconciler serializes it into a {@link PanelTree}.
 */
export const Panel = Object.assign(PanelRoot, {
  Section: primitive<PanelSectionProps>(PANEL_ELEMENT_TYPES.section, "Panel.Section"),
  SectionActions: primitive<PanelSectionActionsProps>(
    PANEL_ELEMENT_TYPES.sectionActions,
    "Panel.SectionActions",
  ),
  Subsection: primitive<PanelSubsectionProps>(PANEL_ELEMENT_TYPES.subsection, "Panel.Subsection"),
  Row: primitive<PanelRowProps>(PANEL_ELEMENT_TYPES.row, "Panel.Row"),
  Column: primitive<PanelColumnProps>(PANEL_ELEMENT_TYPES.column, "Panel.Column"),
  Field: primitive<PanelFieldProps>(PANEL_ELEMENT_TYPES.field, "Panel.Field"),
  Text: primitive<PanelTextProps>(PANEL_ELEMENT_TYPES.text, "Panel.Text"),
  Callout: primitive<PanelCalloutProps>(PANEL_ELEMENT_TYPES.callout, "Panel.Callout"),
  Popover: primitive<PanelPopoverProps>(PANEL_ELEMENT_TYPES.popover, "Panel.Popover"),
  PopoverTrigger: primitive<PanelPopoverTriggerProps>(
    PANEL_ELEMENT_TYPES.popoverTrigger,
    "Panel.PopoverTrigger",
  ),
  PopoverContent: primitive<PanelPopoverContentProps>(
    PANEL_ELEMENT_TYPES.popoverContent,
    "Panel.PopoverContent",
  ),
  Menu: primitive<PanelMenuProps>(PANEL_ELEMENT_TYPES.menu, "Panel.Menu"),
  TextField: primitive<PanelTextFieldProps>(PANEL_ELEMENT_TYPES.textField, "Panel.TextField"),
  SelectField: primitive<PanelSelectFieldProps>(
    PANEL_ELEMENT_TYPES.selectField,
    "Panel.SelectField",
  ),
  ToggleGroup: primitive<PanelToggleGroupProps>(
    PANEL_ELEMENT_TYPES.toggleGroup,
    "Panel.ToggleGroup",
  ),
  SwitchField: primitive<PanelSwitchFieldProps>(
    PANEL_ELEMENT_TYPES.switchField,
    "Panel.SwitchField",
  ),
  Button: primitive<PanelButtonProps>(PANEL_ELEMENT_TYPES.button, "Panel.Button"),
  SliderField: primitive<PanelSliderFieldProps>(
    PANEL_ELEMENT_TYPES.sliderField,
    "Panel.SliderField",
  ),
  ResetAffordance: primitive<PanelResetAffordanceProps>(
    PANEL_ELEMENT_TYPES.resetAffordance,
    "Panel.ResetAffordance",
  ),
  ColorField: primitive<PanelColorFieldProps>(PANEL_ELEMENT_TYPES.colorField, "Panel.ColorField"),
  ColorPicker: primitive<PanelColorPickerProps>(
    PANEL_ELEMENT_TYPES.colorPicker,
    "Panel.ColorPicker",
  ),
  GradientStops: primitive<PanelGradientStopsProps>(
    PANEL_ELEMENT_TYPES.gradientStops,
    "Panel.GradientStops",
  ),
  Swatch: primitive<PanelSwatchProps>(PANEL_ELEMENT_TYPES.swatch, "Panel.Swatch"),
  ImageField: primitive<PanelImageFieldProps>(PANEL_ELEMENT_TYPES.imageField, "Panel.ImageField"),
  AlignmentGrid: primitive<PanelAlignmentGridProps>(
    PANEL_ELEMENT_TYPES.alignmentGrid,
    "Panel.AlignmentGrid",
  ),
  DimensionField: primitive<PanelDimensionFieldProps>(
    PANEL_ELEMENT_TYPES.dimensionField,
    "Panel.DimensionField",
  ),
  FillField: primitive<PanelFillFieldProps>(PANEL_ELEMENT_TYPES.fillField, "Panel.FillField"),
  VariableField: primitive<PanelVariableFieldProps>(
    PANEL_ELEMENT_TYPES.variableField,
    "Panel.VariableField",
  ),
  ActionEditorField: primitive<PanelActionEditorFieldProps>(
    PANEL_ELEMENT_TYPES.actionEditorField,
    "Panel.ActionEditorField",
  ),
  ProductField: primitive<PanelProductFieldProps>(
    PANEL_ELEMENT_TYPES.productField,
    "Panel.ProductField",
  ),
  PropField: primitive<PanelPropFieldProps>(PANEL_ELEMENT_TYPES.propField, "Panel.PropField"),
  DefaultProps: primitive<PanelDefaultPropsProps>(
    PANEL_ELEMENT_TYPES.defaultProps,
    "Panel.DefaultProps",
  ),
});
