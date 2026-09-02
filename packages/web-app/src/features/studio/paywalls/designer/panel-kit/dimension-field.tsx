import type { AlignItems, AlignSelf, FlexDirection } from "@voidhash/mimic-schema";
import {
  deriveAxisSizing,
  fixedAlignSelf,
  hugAlignSelf as engineHugAlignSelf,
  sizingModePatch,
  stretchDirectionFor as engineStretchDirectionFor,
} from "@voidhash/paywall-style-engine";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { Schema } from "effect";
import { ChevronDownIcon } from "lucide-react";

import type { NodeEditorProps } from "../panels/types";
import { TextInput } from "./text-input";

/**
 * The subset of style properties a dimension field reads and writes. Both the
 * width and height axes share this shape; the axis parameter selects which
 * primary dimension (`width`/`height`) is edited and which parent direction
 * collapses the flex-child sizing to `stretch`.
 */
type DimensionNode = NodeEditorProps<
  "width" | "height" | "flex" | "flexGrow" | "flexShrink" | "flexBasis" | "alignSelf"
>["node"];

export type DimensionAxis = "width" | "height";
export type DimensionState = "fill" | "hug" | "custom";

/**
 * The px value shown in the `Fixed … (N px)` menu label (and seeded when
 * switching to a fixed size) when the node has no live bounding box.
 */
export const FALLBACK_FIXED_PX = 100;

export interface DimensionFieldProps {
  axis: DimensionAxis;
  node: DimensionNode;
  onNodeChange: (node: DimensionNode) => void;
  disabled?: boolean;
  parentDirection: FlexDirection;
  /**
   * The parent's resolved `alignItems`. Drives container-driven stretch: an
   * `alignSelf: "auto"` child fills its cross axis only when this is
   * `"stretch"` (the schema default).
   */
  parentAlignItems?: AlignItems;
  /** Live computed pixel value from the canvas bounding box, used for hug/fill labels. */
  computed?: number | null;
  /** Called on each keystroke so the caller can stage a draft; falls back to `onNodeChange`. */
  onDraftChange?: (node: DimensionNode) => void;
  onCommit?: () => void;
}

/**
 * The parent flex direction under which this axis is stretched via `alignSelf`
 * (rather than `flex: 1`). Delegates to the style engine's sizing model.
 */
export function stretchDirectionFor(axis: DimensionAxis): FlexDirection {
  return engineStretchDirectionFor(axis);
}

/**
 * Derives the fill/hug/custom mode for one axis via the style engine's
 * {@link deriveAxisSizing} (the single owner of the CSS sizing ground truth).
 * Exported so a panel DEFINITION can compute the wire `mode` for a
 * `dimensionField` node author-side. The engine calls the numeric mode
 * `"fixed"`; the panel vocabulary keeps its historical `"custom"` name.
 */
export function getDimensionState(
  axis: DimensionAxis,
  node: DimensionNode,
  parentDirection: FlexDirection,
  parentAlignItems: AlignItems = "stretch",
): DimensionState {
  const sizing = deriveAxisSizing(axis, node as Record<string, unknown>, {
    direction: parentDirection,
    alignItems: parentAlignItems,
  });
  return sizing.mode === "fixed" ? "custom" : sizing.mode;
}

/**
 * The `alignSelf` to write when switching a CROSS-axis dimension to Hug.
 * Delegates to the style engine.
 */
export function hugAlignSelf(currentAlignSelf: AlignSelf, parentAlignItems: AlignItems): AlignSelf {
  return engineHugAlignSelf(currentAlignSelf, parentAlignItems);
}

/**
 * The `alignSelf` to write when giving a CROSS-axis dimension a numeric (Fixed)
 * size. Delegates to the style engine.
 */
export function customAlignSelf(currentAlignSelf: AlignSelf): AlignSelf {
  return fixedAlignSelf(currentAlignSelf);
}

/** A flex-sizing style patch a fill/hug/custom mode switch writes. */
export interface DimensionModeWrite {
  width?: number | "auto";
  height?: number | "auto";
  /** `undefined` clears the flex field (main-axis hug/custom). */
  flex?: number | undefined;
  alignSelf?: AlignSelf;
}

/**
 * The style patch to write when a dimension axis switches fill/hug/custom mode.
 * Delegates to the style engine's {@link sizingModePatch} — the single owner of
 * the CSS-correct `alignSelf`/`flex` pairing on both axes — shared by the kit
 * component and the wire panel definitions so they never drift.
 */
export function dimensionModeWrite(
  axis: DimensionAxis,
  mode: DimensionState,
  opts: {
    effectivePx: number;
    parentDirection: FlexDirection;
    parentAlignItems: AlignItems;
    currentAlignSelf: AlignSelf;
  },
): DimensionModeWrite {
  return sizingModePatch(axis, mode === "custom" ? "fixed" : mode, {
    fixedPx: opts.effectivePx,
    parent: { direction: opts.parentDirection, alignItems: opts.parentAlignItems },
    currentAlignSelf: opts.currentAlignSelf,
  }) as DimensionModeWrite;
}

/**
 * The unified width/height editor. Parameterized by `axis`, it preserves the
 * exact fill/hug/custom mode derivation, computed-px menu labels, direct
 * (non-draft) menu writes with paired `alignSelf`/`flex` resets, and
 * draft-callback typing of the two original mirror inputs.
 */
export function DimensionField({
  axis,
  node,
  onNodeChange,
  disabled = false,
  parentDirection,
  parentAlignItems = "stretch",
  computed,
  onDraftChange,
  onCommit,
}: DimensionFieldProps) {
  const state = getDimensionState(axis, node, parentDirection, parentAlignItems);

  const stored = node[axis];
  const effective = computed ?? (stored === "auto" ? FALLBACK_FIXED_PX : stored);

  const applyMode = (mode: DimensionState) => {
    onNodeChange({
      ...node,
      ...dimensionModeWrite(axis, mode, {
        effectivePx: effective,
        parentDirection,
        parentAlignItems,
        currentAlignSelf: node.alignSelf,
      }),
    });
  };

  const handleSelectCustom = () => applyMode("custom");
  const handleSelectHug = () => applyMode("hug");
  const handleSelectFill = () => applyMode("fill");

  const displayValue =
    state === "custom" && stored !== "auto" ? stored.toString() : (computed?.toString() ?? "-");

  const label = axis === "width" ? "Width" : "Height";
  const letter = axis === "width" ? "W" : "H";
  const fixedLabel = axis === "width" ? "Fixed width" : "Fixed height";

  return (
    <TextInput
      disabled={disabled || state !== "custom"}
      icon={<div className="font-bold text-xs">{letter}</div>}
      label={label}
      onChange={(value) => {
        const updated = { ...node, [axis]: Number(value) };
        if (onDraftChange) {
          onDraftChange(updated);
        } else {
          onNodeChange(updated);
        }
      }}
      onCommit={onCommit}
      trailing={
        !disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-transparent pr-3 dark:bg-transparent" size="sm" variant="ghost">
                {state === "custom" && <ChevronDownIcon className="size-3.5" />}
                {state === "hug" && <div className="font-bold text-xs">Hug</div>}
                {state === "fill" && <div className="font-bold text-xs">Fill</div>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={handleSelectCustom}>
                {fixedLabel} ({effective} px)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSelectHug}>Hug content</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSelectFill}>Fill container</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
      type="number"
      typeNumberStepIncrement={1}
      validator={Schema.String}
      value={displayValue}
    />
  );
}

/**
 * Presentational (wire-driven) width/height field. It is the render half of
 * {@link DimensionField} with the flex-sizing derivation lifted out: a panel
 * DEFINITION computes the `mode` (via {@link getDimensionState}), passes the
 * numeric `value` (the stored dimension, or the effective fallback when the axis
 * is `auto`) and the raw `computed` bounding-box px, and this view reconstructs
 * the exact display string + `Fixed … (N px)` menu label the monolith drew. The
 * host reports gestures back — `onChange`/`onCommit` for typing the custom value
 * (as a numeric string), and `onModeChange(mode)` when the fill/hug/custom menu
 * is picked (the definition owns the paired `alignSelf`/`flex`/`width` writes per
 * mode). Byte-matches the monolith's markup so the flag-on panel looks identical.
 */
export interface DimensionFieldViewProps {
  axis: DimensionAxis;
  /** The derived fill/hug/custom mode (input is enabled only in `custom`). */
  mode: DimensionState;
  /**
   * The numeric value: the stored dimension in `custom` mode (what the enabled
   * input shows), and the effective px fallback (e.g. `100`) in `hug`/`fill` —
   * the base for the `Fixed … (N px)` menu label when there is no bounding box.
   */
  value: number;
  /** The raw bounding-box px; drives the hug/fill display and the menu effective px. */
  computed: number | null;
  label: string;
  disabled?: boolean;
  mixed?: boolean;
  onChange: (value: string) => void;
  onCommit?: () => void;
  onModeChange: (mode: DimensionState) => void;
}

/** The render half of {@link DimensionField}, driven purely by wire props. */
export function DimensionFieldView({
  axis,
  mode,
  value,
  computed,
  label,
  disabled = false,
  mixed = false,
  onChange,
  onCommit,
  onModeChange,
}: DimensionFieldViewProps) {
  const letter = axis === "width" ? "W" : "H";
  const fixedLabel = axis === "width" ? "Fixed width" : "Fixed height";
  // Effective px in the `Fixed … (N px)` menu item: the live bounding box when
  // present, else the numeric value the definition supplied (stored / auto→100).
  const effective = computed ?? value;
  // Display string: the stored value in `custom` (input enabled), else the live
  // computed px (or `-` when no bounding box exists) — the monolith's exact rule.
  const displayValue = mode === "custom" ? value.toString() : (computed?.toString() ?? "-");

  return (
    <TextInput
      disabled={disabled || mode !== "custom"}
      icon={<div className="font-bold text-xs">{letter}</div>}
      label={label}
      mixed={mixed}
      onChange={onChange}
      onCommit={onCommit}
      trailing={
        !disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-transparent pr-3 dark:bg-transparent" size="sm" variant="ghost">
                {mode === "custom" && <ChevronDownIcon className="size-3.5" />}
                {mode === "hug" && <div className="font-bold text-xs">Hug</div>}
                {mode === "fill" && <div className="font-bold text-xs">Fill</div>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => onModeChange("custom")}>
                {fixedLabel} ({effective} px)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onModeChange("hug")}>Hug content</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onModeChange("fill")}>
                Fill container
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
      type="number"
      typeNumberStepIncrement={1}
      validator={Schema.String}
      value={displayValue}
    />
  );
}
