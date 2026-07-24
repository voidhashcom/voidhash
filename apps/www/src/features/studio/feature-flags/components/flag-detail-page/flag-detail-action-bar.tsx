"use client";

import { Button } from "@voidhash/ui";

import { useFlagDraft } from "./flag-draft-context";

/**
 * Floating, sticky bar pinned to the bottom of the flag detail screen. Nothing
 * on the screen writes to the server until Save Changes is pressed here.
 */
export function FlagDetailActionBar() {
  const { changeCount, invalidVariantIds, isSaving, readOnly, reset, save } = useFlagDraft();

  if (readOnly) {
    return null;
  }

  const hasInvalidVariants = invalidVariantIds.size > 0;

  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-center bg-background px-6 pt-6 pb-6">
      <div className="mx-auto flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card py-2 pr-2 pl-4 shadow-lg">
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
