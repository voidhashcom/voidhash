import { useLayoutEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerActions, useDesignerSelect } from '../state/designer-store';
import type { NodeData } from '../state/schema';
import { getNodesByParentId } from '../state/utils/nodes';
import { FlexNodeRenderer } from './node-renderers/flex-node-renderer';
import { ScreenNodeRenderer } from './node-renderers/screen-node-renderer';
import { TextNodeRenderer } from './node-renderers/text-node-renderer';
import { useViewport } from './viewport';

export function NodeRenderer({
  node
}: {
  node: NodeData & { children: NodeData[] };
}) {
  const nodes = useDesignerSelect(useShallow((state) => state.nodes));
  const dispatch = useDesignerActions();
  const children = getNodesByParentId(nodes, node.id);
  const elementRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

  // Measure node bounding box on render
  useLayoutEffect(() => {
    // Skip measurement for root nodes
    if (node.type === 'root') {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const measureBoundingBox = () => {
      const rect = element.getBoundingClientRect();

      // Convert screen coordinates to canvas coordinates
      // screenToCanvas expects viewport/screen coordinates
      const canvasCoords = viewport.screenToCanvas(rect.left, rect.top);

      // Get dimensions in canvas space (accounting for scale)
      const transform = viewport.getTransform();
      const canvasWidth = rect.width / transform.scale;
      const canvasHeight = rect.height / transform.scale;

      dispatch('updateBoundingBox', {
        id: node.id,
        boundingBox: {
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: canvasWidth,
          height: canvasHeight
        }
      });
    };

    // Measure immediately
    measureBoundingBox();

    // Also measure on resize
    const resizeObserver = new ResizeObserver(measureBoundingBox);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [node.id, node.type, viewport, dispatch]);

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
      <ScreenNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={{ ...child, children }} />
        ))}
      </ScreenNodeRenderer>
    );
  }
  if (node.type === 'text') {
    return (
      <div ref={elementRef}>
        <TextNodeRenderer node={node} />
      </div>
    );
  }

  if (node.type === 'flex') {
    return (
      <FlexNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={{ ...child, children }} />
        ))}
      </FlexNodeRenderer>
    );
  }

  return null;
}

export function NodeTreeRenderer() {
  const nodes = useDesignerSelect(useShallow((state) => state.nodes));
  const firstLevelNodes = useMemo(() => {
    return Object.values(nodes ?? {}).filter(
      (node) => node.type !== 'root' && node.parent?.id === 'root'
    );
  }, [nodes]);
  return (
    <div className="relative">
      <NodeRenderer
        node={{ type: 'root', id: 'root', children: firstLevelNodes }}
      />
    </div>
  );
}
