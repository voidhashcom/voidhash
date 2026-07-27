"use client";

import { Button } from "@voidhash/ui";

import { useFlagDraft } from "./flag-draft-context";

/**
 * Floating bar pinned to the bottom of the flag detail screen. Nothing on the
 * screen writes to the server until Save Changes is pressed here.
 *
 * `mt-auto` parks it at the bottom of the page's flex column when the content
 * is short, so it never floats mid-screen. The wrapper is transparent and
 * click-through — only the pill itself takes pointer events — so the content
 * scrolling underneath stays visible instead of being masked by a band.
 */
export function FlagDetailActionBar() {
  const { changeCount, invalidVariantIds, isSaving, readOnly, reset, save } = useFlagDraft();

  if (readOnly) {
    return null;
  }

  const hasInvalidVariants = invalidVariantIds.size > 0;

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mt-auto flex items-center justify-center p-6">
      <div className="pointer-events-auto mx-auto flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/80 py-2 pr-2 pl-4 shadow-lg backdrop-blur-md">
        <p className="min-w-[14rem] text-muted-foreground text-sm">
          {hasInvalidVariants
            ? "Fix the invalid variant values to save"
            : changeCount === 0
              ? "No unsaved changes"
              : `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}`}
        </p>
        <Button
          disabled={isSaving || changeCount === 0}
          onClick={reset}
          size="lg"
          variant="ghost"
        >
          Discard
        </Button>
        <Button
          disabled={isSaving || changeCount === 0 || hasInvalidVariants}
          onClick={save}
          size="lg"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
