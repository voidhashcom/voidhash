import type { PanelNodeType } from "@voidhash/paywalls/schema";
import {
  Button,
  Slider,
  Switch,
  ToggleGroup,
} from "@voidhash/ui";
import type { ComponentType } from "react";

import { ActionEditorField } from "./action-editor-field";
import { FlexAlignmentInput } from "./alignment-grid";
import { ColorInput } from "./color-input";
import { ColorPickerContent } from "./color-picker/color-picker-content";
import { ColorSwatch } from "./color-picker/color-swatch";
import { DimensionField } from "./dimension-field";
import { FillField } from "./fill-field";
import { GradientStopBar } from "./gradient-stop-bar";
import { PanelCallout, PanelColumn, PanelField, PanelRow, PanelText } from "./chrome";
import {
  PanelSection,
  PanelSectionHeaderActions,
  PanelSubSection,
} from "./panel-section";
import { OverrideResetAffordance } from "./reset-affordance";
import { SelectInput } from "./select-input";
import { TextInput } from "./text-input";
import { VariableBindingField } from "./variable-binding-field";

/**
 * A kit component target for a wire node type. Props are intentionally erased:
 * the renderer phase writes a per-node prop-adapter that maps the validated
 * wire props/events onto each component's concrete signature, so this map only
 * needs to centralize the type → component association.
 */
// biome-ignore lint/suspicious/noExplicitAny: renderer supplies the adapted props per node type
type KitComponent = ComponentType<any>;

/**
 * Central wire-node-type → host kit component registry. The panel-tree renderer
 * (next phase) looks components up here and applies a prop-adapter. Structural /
 * pure-container node types that carry no component of their own (`panel`,
 * `popover`, `popoverTrigger`, `popoverContent`, `menu`, `imageField`,
 * `propField`, `defaultProps`) are intentionally absent — the renderer handles
 * them directly (Radix `Popover`, container `<div>`s, or context) rather than
 * through a single kit component.
 */
export const PANEL_KIT: Partial<Record<PanelNodeType, KitComponent>> = {
  // Chrome / layout.
  /** `section` → bordered section wrapper (title/header rendered by the renderer). */
  section: PanelSection,
  /** `sectionActions` → right-aligned header action row. */
  sectionActions: PanelSectionHeaderActions,
  /** `subsection` → nested sub-section wrapper. */
  subsection: PanelSubSection,
  /** `row` → horizontal flex row (gap/align/justify). */
  row: PanelRow,
  /** `column` → vertical flex column (gap/align). */
  column: PanelColumn,
  /** `field` → labeled control row (muted label + control column). */
  field: PanelField,
  /** `text` → inline text (variant/tone). */
  text: PanelText,
  /** `callout` → short inline explainer / warning line. */
  callout: PanelCallout,

  // Controls.
  /** `textField` → the battle-tested `TextInput` (drag-scrub, stepper, mixed, validators). */
  textField: TextInput,
  /** `selectField` → `SelectInput` (mixed-aware Radix select). */
  selectField: SelectInput,
  /** `toggleGroup` → shared `ToggleGroup` (single-select segmented control). */
  toggleGroup: ToggleGroup,
  /** `switchField` → shared `Switch`. */
  switchField: Switch,
  /** `button` → shared `Button`. */
  button: Button,
  /** `sliderField` → shared `Slider`. */
  sliderField: Slider,
  /** `resetAffordance` → the override reset pip wrapper. */
  resetAffordance: OverrideResetAffordance,

  // Composites.
  /** `colorField` → `ColorInput` (swatch + hex + opacity, popover picker). */
  colorField: ColorInput,
  /** `colorPicker` → `ColorPickerContent` (saturation/hue/opacity/eyedropper). */
  colorPicker: ColorPickerContent,
  /** `gradientStops` → `GradientStopBar` (draggable stop markers; id↔index in adapter). */
  gradientStops: GradientStopBar,
  /** `swatch` → `ColorSwatch` (compact color/opacity preview chip). */
  swatch: ColorSwatch,
  /** `alignmentGrid` → `FlexAlignmentInput` (3×3 + space-between alignment grid). */
  alignmentGrid: FlexAlignmentInput,
  /** `dimensionField` → `DimensionField` (unified width/height, axis-parameterized). */
  dimensionField: DimensionField,
  /** `fillField` → `FillField` (fill row + solid/gradient/image popover editor). */
  fillField: FillField,
  /** `variableField` → `VariableBindingField` (literal↔variable-reference, serializable literal kinds). */
  variableField: VariableBindingField,
  /** `actionEditorField` → `ActionEditorField` (action type + per-type payload editors). */
  actionEditorField: ActionEditorField,
};
