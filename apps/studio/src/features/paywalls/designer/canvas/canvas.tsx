'use client';

import { useEffect, useRef } from 'react';
import { CANVAS_DEFAULTS } from '../constants';
import { clearSelection, saveCanvasState } from '../state/actions';
import { usePaywallDesignerActions } from '../state/designer-store';
import { NodeTreeRenderer } from './node-tree-renderer';
import { CursorsOverlay } from './overlay/cursors-overlay';
import { SelectionOverlay } from './overlay/selection-overlay';
import { Viewport, type ViewportTransform } from './viewport';

export function Canvas() {
  const dispatch = usePaywallDesignerActions();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Set overscroll-behavior on html and body to prevent overscroll navigation
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    const originalHtmlOverscrollX = htmlElement.style.overscrollBehaviorX;
    const originalBodyOverscrollX = bodyElement.style.overscrollBehaviorX;
    const originalHtmlOverscrollY = htmlElement.style.overscrollBehaviorY;
    const originalBodyOverscrollY = bodyElement.style.overscrollBehaviorY;

    htmlElement.style.overscrollBehaviorX = 'none';
    bodyElement.style.overscrollBehaviorX = 'none';
    htmlElement.style.overscrollBehaviorY = 'none';
    bodyElement.style.overscrollBehaviorY = 'none';

    return () => {
      htmlElement.style.overscrollBehaviorX = originalHtmlOverscrollX;
      bodyElement.style.overscrollBehaviorX = originalBodyOverscrollX;
      htmlElement.style.overscrollBehaviorY = originalHtmlOverscrollY;
      bodyElement.style.overscrollBehaviorY = originalBodyOverscrollY;
    };
  }, []);

  const handleClearSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only clear selection if clicking directly on the canvas background
    if (e.target === e.currentTarget) {
      dispatch(clearSelection)({});
    }
  };

  const handleTransformChange = (newTransform: ViewportTransform) => {
    dispatch(saveCanvasState)({
      scale: newTransform.scale,
      x: newTransform.x,
      y: newTransform.y
    });
  };

  return (
    <div
      className="absolute inset-0 h-full w-full overflow-hidden"
      ref={containerRef}
      style={{
        background: CANVAS_DEFAULTS.BACKGROUND_COLOR
      }}
    >
      <Viewport onTransformChange={handleTransformChange}>
        <div
          className="absolute"
          style={{
            // Large canvas area for clicking to clear selection
            width: CANVAS_DEFAULTS.WORLD_WIDTH,
            height: CANVAS_DEFAULTS.WORLD_HEIGHT,
            // Center the canvas so screens at (0,0) appear in the middle-ish
            left: -CANVAS_DEFAULTS.WORLD_WIDTH / 2,
            top: -CANVAS_DEFAULTS.WORLD_HEIGHT / 2
          }}
        >
          <div
            aria-label="Canvas background"
            className="absolute inset-0"
            onClick={handleClearSelection}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                dispatch(clearSelection)({});
              }
            }}
            role="button"
            tabIndex={0}
          />
          <div
            style={{
              // Offset to place (0,0) at center of the world
              position: 'absolute',
              left: CANVAS_DEFAULTS.WORLD_WIDTH / 2,
              top: CANVAS_DEFAULTS.WORLD_HEIGHT / 2
            }}
          >
            <NodeTreeRenderer />
          </div>
        </div>
        {/* <CursorsOverlay /> */}
      </Viewport>

      {/* Pixi overlay for selection visualization */}
      <SelectionOverlay containerRef={containerRef} />
    </div>
  );
}
