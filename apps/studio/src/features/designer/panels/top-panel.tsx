'use client';

import { Logo } from '@voidhash/ui';
import { PANEL_DIMENSIONS } from './constants';

export function TopPanel() {
  return (
    <div
      className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-border border-b bg-sidebar px-3 backdrop-blur-xl"
      style={{ height: PANEL_DIMENSIONS.TOP_HEIGHT }}
    >
      <Logo className="ml-3" variant="symbol" />
    </div>
  );
}
