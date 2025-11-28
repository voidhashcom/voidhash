'use client';

import { Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef } from 'react';
import { CANVAS_DEFAULTS } from '../constants';
import { useViewport } from './viewport';

export function GridBackground() {
  const graphicsRef = useRef<Graphics | null>(null);
  const viewport = useViewport();

  const drawGrid = useCallback(() => {
    if (!(viewport && graphicsRef.current)) {
      return;
    }

    const graphics = graphicsRef.current;
    graphics.clear();

    const scale = viewport.scaled;
    const baseGridSize = CANVAS_DEFAULTS.GRID_SIZE;

    // Adjust grid size based on zoom level for visual clarity
    let gridSize = baseGridSize;
    if (scale < 0.3) {
      gridSize = baseGridSize * 4;
    } else if (scale < 0.6) {
      gridSize = baseGridSize * 2;
    }

    // Get visible bounds in world coordinates
    const bounds = viewport.getVisibleBounds();
    const startX = Math.floor(bounds.x / gridSize) * gridSize;
    const startY = Math.floor(bounds.y / gridSize) * gridSize;
    const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
    const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

    // Calculate dot size based on zoom (smaller when zoomed out)
    const dotRadius = Math.max(0.5, Math.min(1.5, 1 / scale));
    const alpha = Math.max(0.2, Math.min(0.5, scale * 0.4));

    // Draw dots at grid intersections
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        graphics.circle(x, y, dotRadius);
      }
    }

    graphics.fill({ color: CANVAS_DEFAULTS.GRID_COLOR, alpha });

    // Draw larger dots for major grid lines (every 5 units)
    const majorGridSize = gridSize * 5;
    const majorStartX = Math.floor(bounds.x / majorGridSize) * majorGridSize;
    const majorStartY = Math.floor(bounds.y / majorGridSize) * majorGridSize;
    const majorEndX =
      Math.ceil((bounds.x + bounds.width) / majorGridSize) * majorGridSize;
    const majorEndY =
      Math.ceil((bounds.y + bounds.height) / majorGridSize) * majorGridSize;

    for (let x = majorStartX; x <= majorEndX; x += majorGridSize) {
      for (let y = majorStartY; y <= majorEndY; y += majorGridSize) {
        graphics.circle(x, y, dotRadius * 1.5);
      }
    }

    graphics.fill({ color: CANVAS_DEFAULTS.GRID_COLOR, alpha: alpha * 1.5 });
  }, [viewport]);

  useEffect(() => {
    // Create graphics object and add to viewport
    const graphics = new Graphics();
    graphicsRef.current = graphics;
    viewport.addChild(graphics);

    // Initial draw
    drawGrid();

    // Redraw on viewport changes
    const handleMoved = () => drawGrid();
    const handleZoomed = () => drawGrid();

    viewport.on('moved', handleMoved);
    viewport.on('zoomed', handleZoomed);

    return () => {
      viewport.off('moved', handleMoved);
      viewport.off('zoomed', handleZoomed);
      viewport.removeChild(graphics);
      graphics.destroy();
    };
  }, [viewport, drawGrid]);

  return null;
}
