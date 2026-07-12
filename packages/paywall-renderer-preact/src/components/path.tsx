import type { PathSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildPathStyles } from "@voidhash/paywall-renderer-web-core";

import { useResolvedStyle } from "../hooks/use-resolved-style";

interface PathProps {
  node: PathSnapshotNode;
}

export function Path({ node }: PathProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  const pathStyles = buildPathStyles(style);

  return (
    <path
      d={node.data.d}
      fill={pathStyles.fill}
      fillOpacity={pathStyles.fillOpacity}
      fillRule={pathStyles.fillRule}
      opacity={pathStyles.opacity}
      stroke={pathStyles.stroke}
      strokeLinecap={pathStyles.strokeLinecap}
      strokeLinejoin={pathStyles.strokeLinejoin}
      strokeOpacity={pathStyles.strokeOpacity}
      strokeWidth={pathStyles.strokeWidth}
      transform={node.data.transform}
      vectorEffect="non-scaling-stroke"
    />
  );
}
