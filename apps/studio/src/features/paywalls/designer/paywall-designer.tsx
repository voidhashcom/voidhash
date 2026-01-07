'use client';

import { Logo } from '@voidhash/ui';

import { useEffect, useState } from 'react';
import { useStore } from 'zustand/react';
import { Canvas } from '../designer/canvas/canvas';
import { PreviewCanvas } from '../designer/canvas/preview-canvas';
import {
  PaywallDesignerStoreProvider,
  usePaywallDesignerStore
} from '../designer/state/designer-store';

import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { LeftPanel } from './panels';
import { ActionPanel } from './panels/action-panel';
import { RightPanel } from './panels/right-panel';
import { TopPanel } from './panels/top-panel';

function DesignerContent() {
  useKeyboardShortcuts();
  const store = usePaywallDesignerStore();
  const mode = useStore(store, (state) => state.mode);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Canvas layer - renders under the panels */}
      {mode === 'design' ? <Canvas /> : <PreviewCanvas />}

      {/* Panel overlays */}
      <TopPanel />
      <LeftPanel />
      <RightPanel />
      <ActionPanel />
    </div>
  );
}

function LoadingScreen() {
  const store = usePaywallDesignerStore();
  const [isLoading, setIsLoading] = useState(true);
  const isReady = useStore(store, (state) => state.mimic.isReady);

  useEffect(() => {
    if (isReady) {
      setTimeout(() => {
        setIsLoading(false);
      }, 200);
    }
  }, [isReady]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col gap-8 w-screen items-center fixed inset-0 z-1000 justify-center bg-background">
        <Logo variant="symbol" color="mono" className="h-10 w-10" />
        <div className="relative">
          <div className="h-1 w-42 bg-secondary rounded-full"></div>
          <div className="h-1 left-0 top-0 bg-foreground rounded-full absolute animate-[designer-loading_10s_ease-in-out] fill-mode-forwards"></div>
        </div>
      </div>
    );
  }

  return null;
}

export function DesignerDetailPage({ paywallId }: { paywallId: string }) {
  return (
    <PaywallDesignerStoreProvider paywallId={paywallId}>
      <LoadingScreen />
      <DesignerContent />
    </PaywallDesignerStoreProvider>
  );
}
