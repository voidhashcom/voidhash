"use client";

import { Logo } from "@voidhash/ui";
import { useState } from "react";

/**
 * The designer loading visual renders at several mount points while the editor
 * loads (route pending, lazy-chunk suspense fallback, document connect
 * overlay). The progress bar's start time lives at module scope so the
 * animation continues across those remounts instead of restarting at each
 * phase boundary.
 */
let progressStartedAt: number | null = null;

/** Restarts the loading progress animation for the next designer load. */
export function resetDesignerLoadingProgress(): void {
  progressStartedAt = null;
}

/**
 * Store-free loading visual shown from navigation until the document snapshot
 * has arrived and the editor is revealed.
 */
export function DesignerLoadingScreen() {
  const [elapsedMs] = useState(() => {
    progressStartedAt ??= Date.now();
    return Date.now() - progressStartedAt;
  });

  return (
    <div className="flex h-screen flex-col gap-8 w-screen items-center fixed inset-0 z-1000 justify-center bg-background">
      <Logo variant="symbol" color="mono" className="h-10 w-10" />
      <div className="relative">
        <div className="h-1 w-42 bg-secondary rounded-full" />
        <div
          className="h-1 left-0 top-0 bg-foreground rounded-full absolute animate-[designer-loading_10s_ease-in-out] fill-mode-forwards"
          style={{ animationDelay: `-${elapsedMs}ms` }}
        />
      </div>
    </div>
  );
}
