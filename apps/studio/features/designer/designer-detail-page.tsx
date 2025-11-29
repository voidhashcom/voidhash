'use client';

import { Canvas } from './canvas/canvas';
import { LeftPanel } from './panels';
import { ActionPanel } from './panels/action-panel';
import { RightPanel } from './panels/right-panel';
import { TopPanel } from './panels/top-panel';
import { DesignerStoreProvider } from './state/designer-store';

export function DesignerDetailPage() {
  return (
    <DesignerStoreProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        {/* Canvas layer - renders under the panels */}
        <Canvas />

        {/* Panel overlays */}
        <TopPanel />
        <LeftPanel />
        <RightPanel />
        <ActionPanel />
      </div>
    </DesignerStoreProvider>
  );
}
