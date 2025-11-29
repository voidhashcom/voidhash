import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerSelect } from '../state/designer-store';
import type { NodeData } from '../state/schema';
import { getNodesByParentId } from '../state/utils/nodes';
import { ScreenNodeRenderer } from './node-renderers/screen-node-renderer';
import { TextNodeRenderer } from './node-renderers/text-node-renderer';

export function NodeRenderer({
  node
}: {
  node: NodeData & { children: NodeData[] };
}) {
  const nodes = useDesignerSelect(useShallow((state) => state.nodes));
  const children = getNodesByParentId(nodes, node.id);

  if (node.type === 'root') {
    return (
      <>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={{ ...child, children }} />
        ))}
      </>
    );
  }

  if (node.type === 'screen') {
    return (
      <ScreenNodeRenderer node={node}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={{ ...child, children }} />
        ))}
      </ScreenNodeRenderer>
    );
  }
  if (node.type === 'text') {
    return <TextNodeRenderer node={node} />;
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
      <NodeRenderer
        node={{ type: 'root', id: 'root', children: firstLevelNodes }}
      />
    </pixiContainer>
  );
}
