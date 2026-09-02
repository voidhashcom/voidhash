import {
  buildShapeContainerStyles,
  type ShapeSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand";

import { usePaywallDesignerStore } from "../../state/designer-store";
import { Selectable } from "../helpers/selectable";

export function ShapeNodeRenderer({
  node,
  children,
  ref,
}: {
  node: ShapeSnapshotNode;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  const store = usePaywallDesignerStore();
  const overrideDims = useStore(store, (state) => {
    const { resize } = state;
    if (!resize.isActive) {
      return null;
    }
    return resize.currentNodeDimensions[node.id] ?? null;
  });

  const style = overrideDims
    ? {
        ...node.data.style,
        width: overrideDims.width ?? node.data.style.width,
        height: overrideDims.height ?? node.data.style.height,
      }
    : node.data.style;

  const containerStyles = buildShapeContainerStyles(style);
  const viewBox = node.data.viewBox;
  const viewBoxString = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => (
        <div ref={ref} style={containerStyles as React.CSSProperties} {...selectableProps}>
          <svg
            height="100%"
            preserveAspectRatio={style.preserveAspectRatio}
            style={{ display: "block" }}
            viewBox={viewBoxString}
            width="100%"
          >
            {children}
          </svg>
        </div>
      )}
    </Selectable>
  );
}
