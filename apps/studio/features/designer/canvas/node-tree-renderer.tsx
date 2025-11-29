import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerSelect } from '../state/designer-store';
import type { NodeDataWithoutRoot } from '../state/schema';

function NodeRenderer({ node }: { node: NodeDataWithoutRoot }) {
  return (
    <pixiContainer x={node.x} y={node.y}>
      <pixiGraphics
        draw={(graphics) => {
          graphics.clear();
          graphics.setFillStyle({ color: 0xff_ff_ff, alpha: 1 });
          graphics.rect(0, 0, node.width, node.height);
          graphics.fill();
        }}
      />
    </pixiContainer>
  );
}

export function NodeTreeRenderer() {
  const nodes = useDesignerSelect(useShallow((state) => state.nodes));
  const firstLevelNodes = useMemo(() => {
    return Object.values(nodes).filter(
      (node) => node.type !== 'root' && node.parent?.id === 'root'
    );
  }, [nodes]);
  return (
    <pixiContainer>
      {firstLevelNodes
        .filter((node) => node.type !== 'root')
        .map((node) => (
          <NodeRenderer key={node.id} node={node} />
        ))}
    </pixiContainer>
  );
}
