import { buildPathStyles, type PathSnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { Selectable } from "../helpers/selectable";

export function PathNodeRenderer({
  node,
  ref,
}: {
  node: PathSnapshotNode;
  ref?: React.RefObject<SVGPathElement | null>;
}) {
  const pathStyles = buildPathStyles(node.data.style);

  // Build the <path> element with styles and optional transform
  return (
    <Selectable nodeId={node.id}>
      {(selectableProps) => {
        // Extract only the event handlers we need, excluding role which is not valid for SVG
        const { role: _, ...svgProps } = selectableProps;
        return (
          <path
            d={node.data.d}
            fill={pathStyles.fill}
            fillOpacity={pathStyles.fillOpacity}
            fillRule={pathStyles.fillRule}
            opacity={pathStyles.opacity}
            ref={ref}
            stroke={pathStyles.stroke}
            strokeLinecap={pathStyles.strokeLinecap}
            strokeLinejoin={pathStyles.strokeLinejoin}
            strokeOpacity={pathStyles.strokeOpacity}
            strokeWidth={pathStyles.strokeWidth}
            transform={node.data.transform}
            vectorEffect="non-scaling-stroke"
            {...svgProps}
          />
        );
      }}
    </Selectable>
  );
}
