'use client';

import { Canvas } from './canvas/canvas';
import { LeftPanel } from './panels';
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
        {/* <RightPanel /> */}
      </div>
    </DesignerStoreProvider>
  );
}
