"use client";

import { cn, Textarea } from "@voidhash/ui";
import { useRef, useState } from "react";

import type { FlagType } from "../../lib/flag-type";
import { FlagTypeIndicator } from "../shared/flag-type-indicator";
import { useFlagDraft } from "./flag-draft-context";

interface FlagDetailHeaderProps {
  flagType: FlagType;
  slug: string;
}

/**
 * Click-to-edit field state. Escape flips a ref rather than clearing the draft
 * alone, so the blur that follows the input unmounting can tell a cancel from
 * a commit — the blur handler still closes over the pre-cancel draft.
 */
function useInlineEdit(onCommit: (next: string) => void) {
  const [draft, setDraft] = useState<null | string>(null);
  const cancelled = useRef(false);

  return {
    cancel: () => {
      cancelled.current = true;
      setDraft(null);
    },
    change: setDraft,
    commit: (next: string) => {
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      setDraft(null);
      onCommit(next);
    },
    draft,
    start: (value: string) => {
      cancelled.current = false;
      setDraft(value);
    },
  };
}

/**
 * Flag title and description. The slug is the flag's identity in customer code,
 * so it is read-only here; the description is edited in place — click it, type,
 * and commit with Enter (Escape reverts). Committing only stages the change;
 * the bottom action bar saves it.
 */
export function FlagDetailHeader({ flagType, slug }: FlagDetailHeaderProps) {
  const { description, readOnly, setDescription } = useFlagDraft();

  const descriptionEdit = useInlineEdit((next) => setDescription(next.trim()));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 break-all font-mono font-semibold text-3xl tracking-tight">
          {slug}
        </h1>
        <FlagTypeIndicator className="shrink-0 text-muted-foreground" flagType={flagType} />
      </div>

      {descriptionEdit.draft === null ? (
        <button
          className={cn(
            "-mx-2 block w-full rounded-md px-2 py-0.5 text-left text-sm",
            description ? "text-muted-foreground" : "text-muted-foreground/70",
            readOnly ? "cursor-default" : "hover:bg-muted/60",
          )}
          disabled={readOnly}
          onClick={() => descriptionEdit.start(description)}
          type="button"
        >
          {description || "Add a description..."}
        </button>
      ) : (
        <Textarea
          // the field only exists once the user opts into editing
          autoFocus
          aria-label="Flag description"
          className="-mx-2 min-h-0 w-[calc(100%+1rem)] resize-none border-transparent bg-muted/60 px-2 py-0.5 text-sm shadow-none"
          onBlur={(event) => descriptionEdit.commit(event.target.value)}
          onChange={(event) => descriptionEdit.change(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              descriptionEdit.cancel();
            }
          }}
          placeholder="Add a description..."
          rows={1}
          value={descriptionEdit.draft}
        />
      )}
    </div>
  );
}
