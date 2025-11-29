'use client';

import { Application, extend } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import { useRef } from 'react';
import { CANVAS_DEFAULTS } from '../constants';
import { useDesignerSelect } from '../state/designer-store';
import { GridBackground } from './grid-background';
import { NodeTreeRenderer } from './node-tree-renderer';
import { Viewport } from './viewport';

extend({ Container, Graphics });

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const showGrid = useDesignerSelect((state) => state.debug.showGrid);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      ref={containerRef}
      style={{ background: CANVAS_DEFAULTS.BACKGROUND_COLOR }}
    >
      <Application
        antialias
        autoDensity
        background={CANVAS_DEFAULTS.BACKGROUND_COLOR}
        resizeTo={containerRef}
        resolution={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
      >
        <Viewport>
          {showGrid && <GridBackground />}
          <NodeTreeRenderer />
        </Viewport>
      </Application>
    </div>
  );
}
