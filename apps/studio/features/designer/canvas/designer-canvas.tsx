'use client';

import { Application, extend } from '@pixi/react';
import { Container } from 'pixi.js';
import { useRef } from 'react';
import { CANVAS_DEFAULTS } from '../constants';
import { useDesignerSelect } from '../state/designer-store';
import type { DesignerCanvasProps } from '../types';
import { GridBackground } from './grid-background';
import { Viewport } from './viewport';

extend({ Container });

export function DesignerCanvas({ children }: DesignerCanvasProps) {
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
          {children}
        </Viewport>
      </Application>
    </div>
  );
}
