"use client";

import { Button, cn } from "@voidhash/ui";
import { CopyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

const PROPERTY_VALUE_BASE =
  "-ml-2.5 flex items-center gap-2 px-2.5 font-normal text-foreground text-sm";

/**
 * The box every value sits in, static or interactive, so the whole column
 * shares one height, type scale, weight and inset. The negative margin cancels
 * the horizontal padding a trigger needs for its hover state, which keeps the
 * text on the same axis whether or not the row is clickable.
 */
export const PROPERTY_VALUE_CLASS_NAME = cn(PROPERTY_VALUE_BASE, "h-7");

/**
 * Dimmed a step below the interactive rows so what can be changed reads as the
 * brighter text, while staying clear of the still-dimmer property labels.
 */
const PROPERTY_VALUE_DIMMED = "text-foreground/80";

/**
 * Static values swap the trigger's fixed height for `min-h-7` so a value that
 * wraps grows its row instead of spilling into the next one.
 */
const PROPERTY_VALUE_STATIC_CLASS_NAME = cn(
  PROPERTY_VALUE_BASE,
  "min-h-7 py-1",
  PROPERTY_VALUE_DIMMED,
);

/**
 * Section wrapper for a detail screen's property list — the heading plus the
 * definition list the rows live in.
 */
export function PropertyList({
  children,
  title = "Properties",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

/** One labelled row of a {@link PropertyList}. */
export function PropertyRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/** Static counterpart to a trigger — same box, no interaction. */
export function PropertyValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(PROPERTY_VALUE_STATIC_CLASS_NAME, className)}>{children}</span>;
}

/** Placeholder for a value the record doesn't carry — "None", "Unknown". */
export function PropertyEmpty({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** Coloured dot that prefixes a status label. */
export function PropertyStatusDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", className)} />;
}

/**
 * Identifier row whose value copies itself — slugs exist to be pasted into
 * code, so the value doubles as the copy affordance. The icon only shows on
 * hover to keep the row reading as text until it is reached for.
 */
export function PropertyCopyValue({ label, value }: { label: string; value: string }) {
  return (
    <Button
      aria-label={`Copy ${label}`}
      className={cn(PROPERTY_VALUE_CLASS_NAME, PROPERTY_VALUE_DIMMED, "group max-w-full")}
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`${label} copied to clipboard`);
      }}
      size="sm"
      variant="ghost"
    >
      <span className="min-w-0 truncate font-mono text-xs">{value}</span>
      <CopyIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100" />
    </Button>
  );
}

/**
 * Outbound link styled as an interactive value, so a row that navigates
 * somewhere carries the same hover surface as one that opens an editor.
 */
export function PropertyLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Button asChild className={PROPERTY_VALUE_CLASS_NAME} size="sm" variant="ghost">
      <a href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    </Button>
  );
}

/** Date format shared by every `Created`/`Updated` property row. */
export const formatPropertyDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
