"use client";

import { cn, Input, Textarea } from "@voidhash/ui";
import { useRef, useState } from "react";

import { useExperimentDraft } from "./experiment-draft-context";

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

function InlineTextarea({
  ariaLabel,
  edit,
  emptyLabel,
  readOnly,
  value,
}: {
  ariaLabel: string;
  edit: ReturnType<typeof useInlineEdit>;
  emptyLabel: string;
  readOnly: boolean;
  value: string;
}) {
  if (edit.draft === null) {
    return (
      <button
        className={cn(
          "-mx-2 block w-full rounded-md px-2 py-0.5 text-left text-sm",
          value ? "text-muted-foreground" : "text-muted-foreground/70",
          readOnly ? "cursor-default" : "hover:bg-muted/60",
        )}
        disabled={readOnly}
        onClick={() => edit.start(value)}
        type="button"
      >
        {value || emptyLabel}
      </button>
    );
  }
  return (
    <Textarea
      // the field only exists once the user opts into editing
      autoFocus
      aria-label={ariaLabel}
      className="-mx-2 min-h-0 w-[calc(100%+1rem)] resize-none border-transparent bg-muted/60 px-2 py-0.5 text-sm shadow-none"
      onBlur={(event) => edit.commit(event.target.value)}
      onChange={(event) => edit.change(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          edit.cancel();
        }
      }}
      placeholder={emptyLabel}
      rows={1}
      value={edit.draft}
    />
  );
}

/**
 * A/B-test title, description, and hypothesis, all edited in place — click,
 * type, commit with Enter (Escape reverts). Committing only stages the change;
 * the bottom action bar saves it.
 */
export function ExperimentDetailHeader() {
  const { description, hypothesis, name, readOnly, setDescription, setHypothesis, setName } =
    useExperimentDraft();

  const nameEdit = useInlineEdit((next) => {
    if (next.trim().length > 0) {
      setName(next.trim());
    }
  });
  const descriptionEdit = useInlineEdit((next) => setDescription(next.trim()));
  const hypothesisEdit = useInlineEdit((next) => setHypothesis(next.trim()));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {nameEdit.draft === null ? (
          <button
            className={cn(
              "-mx-2 block w-full truncate rounded-md px-2 py-0.5 text-left font-semibold text-3xl tracking-tight",
              readOnly ? "cursor-default" : "hover:bg-muted/60",
            )}
            disabled={readOnly}
            onClick={() => nameEdit.start(name)}
            type="button"
          >
            {name}
          </button>
        ) : (
          <Input
            // the field only exists once the user opts into editing
            autoFocus
            aria-label="A/B test name"
            className="-mx-2 h-auto w-[calc(100%+1rem)] border-transparent bg-muted/60 px-2 py-0.5 font-semibold text-3xl tracking-tight shadow-none md:text-3xl"
            onBlur={(event) => nameEdit.commit(event.target.value)}
            onChange={(event) => nameEdit.change(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                nameEdit.cancel();
              }
            }}
            value={nameEdit.draft}
          />
        )}
        <InlineTextarea
          ariaLabel="A/B test description"
          edit={descriptionEdit}
          emptyLabel="Add a description..."
          readOnly={readOnly}
          value={description}
        />
      </div>

      <div className="space-y-1">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Hypothesis
        </h2>
        <InlineTextarea
          ariaLabel="A/B test hypothesis"
          edit={hypothesisEdit}
          emptyLabel="What do you expect to happen, and why?"
          readOnly={readOnly}
          value={hypothesis}
        />
      </div>
    </div>
  );
}
