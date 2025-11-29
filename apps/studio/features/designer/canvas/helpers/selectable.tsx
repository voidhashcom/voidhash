import type { Container } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CANVAS_DEFAULTS } from '../../constants';
import {
  useDesignerActions,
  useDesignerSelect
} from '../../state/designer-store';
import { useViewport } from '../viewport';

export type SelectableProps = {
  children: ({ isSelected }: { isSelected: boolean }) => React.ReactNode;
  nodeId: string;
};

export function Selectable({ children, nodeId }: SelectableProps) {
  const viewport = useViewport();
  const isSelected = useDesignerSelect(
    useShallow((state) => state.selectedNodeIds.includes(nodeId))
  );
  const dispatch = useDesignerActions();
  const handleClick = (e: MouseEvent) => {
    e.stopImmediatePropagation();
    dispatch('nodeClicked', { id: nodeId, shiftKey: e.shiftKey });
  };

  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!viewport) {
      return;
    }
    const handleRender = () => {
      setScale(viewport.scale.x);
    };
    viewport.on('zoomed', handleRender);
    return () => {
      viewport.off('zoomed', handleRender);
    };
  }, [viewport]);

  const containerRef = useRef<Container>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setSize({
        width: containerRef.current.width,
        height: containerRef.current.height
      });
    }
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: custom selectable element
    <pixiContainer
      eventMode={'static'}
      onClick={handleClick}
      ref={containerRef}
    >
      {children({ isSelected })}
      <pixiGraphics
        draw={(graphics) => {
          graphics.clear();
          if (isSelected) {
            graphics.setStrokeStyle({
              color: CANVAS_DEFAULTS.PRIMARY_COLOR,
              alpha: 1,
              width: 2 / scale
            });
            graphics.setFillStyle({
              color: CANVAS_DEFAULTS.PRIMARY_COLOR,
              alpha: 0.0
            });
            graphics.rect(0, 0, size.width, size.height);
            graphics.stroke();
            graphics.fill();
          }
        }}
      />
    </pixiContainer>
  );
}
