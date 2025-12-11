'use client';

import { Canvas } from '../designer/canvas/canvas';
import { PaywallDesignerStoreProvider } from '../designer/state/designer-store';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { LeftPanel } from './panels';
import { ActionPanel } from './panels/action-panel';
import { RightPanel } from './panels/right-panel';
import { TopPanel } from './panels/top-panel';

function DesignerContent() {
  useKeyboardShortcuts();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Canvas layer - renders under the panels */}
      <Canvas />

      {/* Panel overlays */}
      <TopPanel />
      <LeftPanel />
      <RightPanel />
      <ActionPanel />
    </div>
  );
}

export function DesignerDetailPage() {
  return (
    <PaywallDesignerStoreProvider>
      <DesignerContent />
    </PaywallDesignerStoreProvider>
  );
}
