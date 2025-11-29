'use client';

import '@pixi/layout';
import { LayoutContainer } from '@pixi/layout/components';
import { Application, extend } from '@pixi/react';
import { Container, type FederatedPointerEvent, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { CANVAS_DEFAULTS } from '../constants';
import { useDesignerActions, useDesignerSelect } from '../state/designer-store';
import { GridBackground } from './grid-background';
import { NodeTreeRenderer } from './node-tree-renderer';
import { Viewport } from './viewport';

extend({ Container, Graphics, LayoutContainer });

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const showGrid = useDesignerSelect((state) => state.debug.showGrid);
  const dispatch = useDesignerActions();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Prevent browser zoom on trackpad pinch gestures
    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch gestures have ctrlKey set to true
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Prevent iOS gesture zoom
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart);
    container.addEventListener('gesturechange', handleGestureChange);
    container.addEventListener('gestureend', handleGestureEnd);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
      container.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  useEffect(() => {
    // Set overscroll-behavior-x on html and body to prevent horizontal overscroll
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    const originalHtmlOverscroll = htmlElement.style.overscrollBehaviorX;
    const originalBodyOverscroll = bodyElement.style.overscrollBehaviorX;

    htmlElement.style.overscrollBehaviorX = 'none';
    bodyElement.style.overscrollBehaviorX = 'none';

    return () => {
      htmlElement.style.overscrollBehaviorX = originalHtmlOverscroll;
      bodyElement.style.overscrollBehaviorX = originalBodyOverscroll;
    };
  }, []);

  const handleClearSelection = (e: FederatedPointerEvent) => {
    if (e.target.constructor.name === 'ViewportWrapper') {
      dispatch('clearSelection', {});
    }
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      ref={containerRef}
      style={{
        background: CANVAS_DEFAULTS.BACKGROUND_COLOR,
        touchAction: 'pan-x pan-y'
      }}
    >
      <Application
        antialias
        autoDensity
        background={CANVAS_DEFAULTS.BACKGROUND_COLOR}
        eventMode="static"
        onInit={(app) => {
          app.stage.addEventListener('mousedown', handleClearSelection);
        }}
        resizeTo={containerRef}
        resolution={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
      >
        {/* This container is used to clear the selection when clicking outside the canvas */}
        <Viewport>
          {showGrid && <GridBackground />}
          <NodeTreeRenderer />
        </Viewport>
      </Application>
    </div>
  );
}
