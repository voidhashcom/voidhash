"use client";

import { Button } from "@voidhash/ui";

import { useExperimentDraft } from "./experiment-draft-context";

/**
 * Floating bar pinned to the bottom of the A/B-test detail screen. Nothing on
 * the screen writes to the server until Save Changes is pressed here.
 *
 * `mt-auto` parks it at the bottom of the page's flex column when the content
 * is short, so it never floats mid-screen. The wrapper is transparent and
 * click-through — only the pill itself takes pointer events — so the content
 * scrolling underneath stays visible instead of being masked by a band.
 */
export function ExperimentDetailActionBar() {
  const { blocker, changeCount, isSaving, readOnly, reset, save } = useExperimentDraft();

  if (readOnly) {
    return null;
  }

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mt-auto flex items-center justify-center p-6">
      <div className="pointer-events-auto mx-auto flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/80 py-2 pr-2 pl-4 shadow-lg backdrop-blur-md">
        <p className="min-w-[14rem] text-muted-foreground text-sm">
          {blocker ??
            (changeCount === 0
              ? "No unsaved changes"
              : `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}`)}
        </p>
        <Button disabled={isSaving || changeCount === 0} onClick={reset} size="lg" variant="ghost">
          Discard
        </Button>
        <Button
          disabled={isSaving || changeCount === 0 || blocker !== null}
          onClick={save}
          size="lg"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
