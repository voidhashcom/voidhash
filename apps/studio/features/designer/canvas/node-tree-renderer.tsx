import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerSelect } from '../state/designer-store';
import type { NodeDataWithoutRoot } from '../state/schema';
import { ScreenNodeRenderer } from './node-renderers/screen-node-renderer';

function NodeRenderer({ node }: { node: NodeDataWithoutRoot }) {
  if (node.type === 'screen') {
    return <ScreenNodeRenderer node={node} />;
  }
  return null;
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
