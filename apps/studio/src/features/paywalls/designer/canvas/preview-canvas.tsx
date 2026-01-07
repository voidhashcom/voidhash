'use client';

import { renderPaywall } from '@voidhash/paywall-renderer-preact';
import type { SnapshotNode } from '@voidhash/paywall-renderer-web-core';
import { useMemo } from 'react';
import { useStore } from 'zustand/react';
import { CANVAS_DEFAULTS } from '../constants';
import { PANEL_DIMENSIONS } from '../panels/constants';
import { usePaywallDesignerStore } from '../state/designer-store';

export function PreviewCanvas() {
  const store = usePaywallDesignerStore();
  const previewSnapshot = useStore(store, (state) => state.previewSnapshot);
  const previewScale = useStore(store, (state) => state.previewScale);

  const html = useMemo(() => {
    if (!previewSnapshot) {
      return '';
    }
    return renderPaywall(previewSnapshot as SnapshotNode).html;
  }, [previewSnapshot]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        backgroundColor: CANVAS_DEFAULTS.BACKGROUND_COLOR,
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '16px 16px'
      }}
    >
      {/* Phone mockup container - maintains aspect ratio and scales to fit */}
      <div className="relative flex h-full w-full items-center justify-center p-8">
        <div
          className="relative h-full max-h-[812px] w-full max-w-[375px]"
          style={{
            aspectRatio: '375 / 812',
            transform: `scale(${previewScale})`,
            transformOrigin: 'center center'
          }}
        >
          {/* Phone frame */}
          <div className="h-full w-full overflow-hidden rounded-[40px] border-8 border-zinc-800 bg-zinc-800 shadow-2xl">
            <iframe
              className="h-full w-full bg-white"
              srcDoc={html}
              title="Paywall Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
