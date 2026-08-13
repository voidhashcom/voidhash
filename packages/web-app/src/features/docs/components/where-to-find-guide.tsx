"use client";

import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@voidhash/ui";
import { CircleHelpIcon, ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { docsSiteUrl } from "virtual:voidhash-web/edition";

import { GuideBody } from "@/features/docs/lib/guide-content";

/**
 * A reusable "Where to find?" affordance. Renders an inline link-style button
 * that opens a Sheet showing a documentation guide (authored as MDX under the
 * docs collection) so users can learn where to obtain a value without leaving
 * the form. The same guide is published on the docs site, linked from the sheet
 * footer; community deployments link out to the public site because the docs
 * site itself is hosted-only.
 *
 * The guide MDX chunk is only fetched the first time the sheet is opened.
 *
 * @param guide - Guide slug, matching its published path under the docs site
 *   (e.g. `guides/payment-providers/apple-app-store/bundle-id`).
 * @param fieldLabel - The field name, used in the sheet title.
 * @param label - Trigger text. Defaults to "Where to find?".
 */
export function WhereToFindGuide({
  guide,
  fieldLabel,
  label = "Where to find?",
  className,
}: {
  guide: string;
  fieldLabel?: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "h-auto gap-1 p-0 font-normal text-muted-foreground hover:text-foreground",
            className,
          )}
          size="sm"
          type="button"
          variant="link"
        >
          <CircleHelpIcon />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {fieldLabel ? <>Where to find your {fieldLabel}</> : "Where to find this"}
          </SheetTitle>
          <SheetDescription>
            Follow these steps, then copy the value back into Voidhash.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {open ? <GuideBody slug={guide} /> : null}
        </div>
        <div className="border-t p-4">
          <a
            className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
            href={`${docsSiteUrl}/${guide}`}
            rel="noreferrer"
            target="_blank"
          >
            Open full guide
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
