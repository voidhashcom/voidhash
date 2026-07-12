import type { AlignItems, FlexDirection } from "@voidhash/mimic-schema";

import { DimensionField } from "@/features/studio/paywalls/designer/panel-kit/dimension-field";

import type { NodeEditorProps } from "../../types";

type WidthInputProps = NodeEditorProps<
  "width" | "height" | "flex" | "flexGrow" | "flexShrink" | "flexBasis" | "alignSelf"
> & {
  disabled?: boolean;
  parentDirection: FlexDirection;
  parentAlignItems?: AlignItems;
  computedWidth?: number | null;
  onDraftChange?: (
    node: NodeEditorProps<
      "width" | "height" | "flex" | "flexGrow" | "flexShrink" | "flexBasis" | "alignSelf"
    >["node"],
  ) => void;
  onCommit?: () => void;
};

/**
 * Width-axis specialization of {@link DimensionField}. Kept as a thin wrapper so
 * the flex-layout and shape-layout sections keep their existing call sites
 * (`computedWidth` prop name) while the shared logic lives in the kit.
 */
export function WidthInput({
  node,
  onNodeChange,
  disabled = false,
  parentDirection,
  parentAlignItems,
  computedWidth,
  onDraftChange,
  onCommit,
}: WidthInputProps) {
  return (
    <DimensionField
      axis="width"
      computed={computedWidth}
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
