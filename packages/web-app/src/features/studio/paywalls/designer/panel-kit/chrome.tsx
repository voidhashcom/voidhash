import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

/**
 * Small chrome/layout primitives for the panel-tree renderer. The wire has
 * `row`/`column`/`field`/`text`/`callout` chrome nodes with no existing kit
 * component; these are the minimal host targets, following the layout
 * conventions of the current sections (labeled rows are a fixed-width muted
 * label + a flexible control column).
 */

type Align = "start" | "center" | "end" | "stretch";
type Justify = "start" | "center" | "end" | "between";

const ALIGN_CLASS: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const JUSTIFY_CLASS: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

export interface PanelRowProps {
  gap?: number;
  align?: Align;
  justify?: Justify;
  className?: string;
  children?: ReactNode;
}

/** Horizontal flex row. */
export function PanelRow({ gap = 2, align = "center", justify, className, children }: PanelRowProps) {
  return (
    <div
      className={cn(
        "flex flex-row",
        ALIGN_CLASS[align],
        justify ? JUSTIFY_CLASS[justify] : undefined,
        className,
      )}
      style={{ gap: `${gap * 0.25}rem` }}
    >
      {children}
    </div>
  );
}

export interface PanelColumnProps {
  gap?: number;
  align?: Align;
  className?: string;
  children?: ReactNode;
}

/** Vertical flex column. */
export function PanelColumn({ gap = 2, align = "stretch", className, children }: PanelColumnProps) {
  return (
    <div
      className={cn("flex flex-col", ALIGN_CLASS[align], className)}
      style={{ gap: `${gap * 0.25}rem` }}
    >
      {children}
    </div>
  );
}

export interface PanelFieldProps {
  label: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * A labeled control row: a fixed-width truncating muted label (with an optional
 * leading icon) followed by the control(s). Mirrors the labeled-row layout the
 * sections use (e.g. component props, action payload rows).
 */
export function PanelField({ label, icon, className, children }: PanelFieldProps) {
  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <span
        className="flex min-w-16 max-w-24 items-center gap-1 truncate text-muted-foreground text-xs"
        title={label}
      >
        {icon}
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-row items-center gap-1">{children}</div>
    </div>
  );
}

type TextTone = "default" | "muted";

export interface PanelTextProps {
  content: string;
  variant?: "body" | "label";
  tone?: TextTone;
  className?: string;
}

/** Inline text node (`body`/`label` variants, default/muted tone). */
export function PanelText({ content, variant = "body", tone = "default", className }: PanelTextProps) {
  return (
    <span
      className={cn(
        variant === "label" ? "font-medium text-xs" : "text-xs",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {content}
    </span>
  );
}

type CalloutTone = "info" | "warning" | "danger";

const CALLOUT_TONE_CLASS: Record<CalloutTone, string> = {
  info: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-destructive",
};

export interface PanelCalloutProps {
  message: string;
  tone?: CalloutTone;
  className?: string;
}

/** A short inline explainer/warning line. */
export function PanelCallout({ message, tone = "info", className }: PanelCalloutProps) {
  return <p className={cn("text-xs", CALLOUT_TONE_CLASS[tone], className)}>{message}</p>;
}
