import type { ShapeSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildShapeContainerStyles } from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";

import { useResolvedStyle } from "../hooks/use-resolved-style";

interface ShapeProps {
  node: ShapeSnapshotNode;
  children: ComponentChildren;
}

export function Shape({ node, children }: ShapeProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  const containerStyles = buildShapeContainerStyles(style);
  const viewBox = node.data.viewBox;
  const viewBoxString = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <div data-node-id={node.id} style={containerStyles as Record<string, string | number>}>
      <svg
        height="100%"
        preserveAspectRatio={style.preserveAspectRatio as string}
        style={{ display: "block" }}
        viewBox={viewBoxString}
        width="100%"
      >
        {children as unknown as null}
      </svg>
    </div>
  );
}
