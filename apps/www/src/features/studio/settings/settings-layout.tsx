"use client";

import { Card, CardContent, CardFooter, cn } from "@voidhash/ui";
import type { ReactNode } from "react";

/**
 * Scroll container and header chrome for a settings screen. Renders a large
 * page title plus optional description and right-aligned actions, then
 * vertically stacks the section children with consistent gaps.
 */
export function SettingsPage({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 pt-10 pb-16 sm:px-8">
      <header className="flex flex-col gap-3 border-border/60 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="flex min-w-0 items-center font-semibold text-2xl text-foreground tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/**
 * A visually grouped block of related settings. Renders a section heading
 * with optional description and right-aligned header action above the
 * children. Children are typically a {@link SettingsCard} or raw
 * {@link SettingsRow}s.
 */
export function SettingsSection({
  title,
  description,
  headerAction,
  children,
  className,
}: {
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {title || description || headerAction ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title ? (
              <h2 className="font-semibold text-base text-foreground tracking-tight">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-[13px] text-muted-foreground/90 leading-relaxed">{description}</p>
            ) : null}
          </div>
          {headerAction ? (
            <div className="flex shrink-0 items-center gap-2">{headerAction}</div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * Card surface for settings content. Built on top of the shared {@link Card}
 * primitive so that backgrounds, rings, and the destructive variant stay in
 * sync with the rest of the app.
 *
 * Pass `footer` to render an action bar (e.g. a Save button) inside a
 * {@link CardFooter}. When provided, children are wrapped in a
 * {@link CardContent}; otherwise children render directly inside the
 * {@link Card} so multi-row lists sit on the standard muted surface.
 */
export function SettingsCard({
  children,
  footer,
  className,
  variant = "default",
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  variant?: "default" | "destructive";
}) {
  if (footer) {
    return (
      <Card className={className} variant={variant}>
        <CardContent className="p-0">{children}</CardContent>
        <CardFooter className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          {footer}
        </CardFooter>
      </Card>
    );
  }
  return (
    <Card className={cn("p-0", className)} variant={variant}>
      {children}
    </Card>
  );
}

/**
 * A single row inside a {@link SettingsCard}. Lays out a title + description
 * block on the left and an optional control on the right, switching to a
 * stacked layout on small screens. Rows are separated by a hairline divider,
 * with the first row having no top border.
 */
export function SettingsRow({
  title,
  description,
  status,
  control,
  children,
  className,
  destructive = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <div className={cn("border-border/60 border-t px-4 py-4 first:border-t-0 sm:px-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {title || description ? (
          <div className="min-w-0 flex-1 space-y-1 pt-1">
            {title ? (
              <h3
                className={cn(
                  "font-medium text-sm leading-snug",
                  destructive ? "text-destructive" : "text-foreground",
                )}
              >
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
            ) : null}
            {status ? (
              <div className="pt-0.5 text-[11px] text-muted-foreground/80">{status}</div>
            ) : null}
          </div>
        ) : null}
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
