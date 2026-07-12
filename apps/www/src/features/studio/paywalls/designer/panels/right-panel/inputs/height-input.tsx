import type { AlignItems, FlexDirection } from "@voidhash/mimic-schema";

import { DimensionField } from "@/features/studio/paywalls/designer/panel-kit/dimension-field";

import type { NodeEditorProps } from "../../types";

type HeightInputProps = NodeEditorProps<
  "width" | "height" | "flex" | "flexGrow" | "flexShrink" | "flexBasis" | "alignSelf"
> & {
  disabled?: boolean;
  parentDirection: FlexDirection;
  parentAlignItems?: AlignItems;
  computedHeight?: number | null;
  onDraftChange?: (
    node: NodeEditorProps<
      "width" | "height" | "flex" | "flexGrow" | "flexShrink" | "flexBasis" | "alignSelf"
    >["node"],
  ) => void;
  onCommit?: () => void;
};

/**
 * Height-axis specialization of {@link DimensionField}. Kept as a thin wrapper so
 * the flex-layout and shape-layout sections keep their existing call sites
 * (`computedHeight` prop name) while the shared logic lives in the kit.
 */
export function HeightInput({
  node,
  onNodeChange,
  disabled = false,
  parentDirection,
  parentAlignItems,
  computedHeight,
  onDraftChange,
  onCommit,
}: HeightInputProps) {
  return (
    <DimensionField
      axis="height"
      computed={computedHeight}
      disabled={disabled}
      node={node}
      onCommit={onCommit}
      onDraftChange={onDraftChange}
      onNodeChange={onNodeChange}
      parentAlignItems={parentAlignItems}
      parentDirection={parentDirection}
    />
  );
}
