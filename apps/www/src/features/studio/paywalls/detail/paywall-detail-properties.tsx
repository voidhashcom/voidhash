"use client";

import { cn } from "@voidhash/ui";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PaywallDetailPropertiesProps {
  createdAt: Date | null;
  draftVersion: number | null;
  isArchived: boolean;
  isLive: boolean;
  liveRelease: { htmlUrl: string; version: number } | null;
  slug: string;
}

type PaywallStatus = "archived" | "draft" | "live" | "not-live";

const STATUS_PRESENTATION: Record<PaywallStatus, { dotClassName: string; label: string }> = {
  archived: { dotClassName: "bg-muted-foreground", label: "Archived" },
  draft: { dotClassName: "bg-amber-500", label: "Draft" },
  live: { dotClassName: "bg-emerald-500", label: "Live" },
  "not-live": { dotClassName: "bg-muted-foreground/50", label: "Not live" },
};

const resolveStatus = (input: {
  draftVersion: number | null;
  isArchived: boolean;
  isLive: boolean;
}): PaywallStatus => {
  if (input.isArchived) {
    return "archived";
  }
  if (input.isLive) {
    return "live";
  }
  return input.draftVersion == null ? "not-live" : "draft";
};

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function PropertyRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-baseline gap-4 py-1.5">
      <dt className="w-28 shrink-0 text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

/**
 * Linear-style property list for the paywall detail screen — status, which
 * versions are live and drafted, and its identifiers.
 */
export function PaywallDetailProperties({
  createdAt,
  draftVersion,
  isArchived,
  isLive,
  liveRelease,
  slug,
}: PaywallDetailPropertiesProps) {
  const status = resolveStatus({ draftVersion, isArchived, isLive });
  const { dotClassName, label } = STATUS_PRESENTATION[status];

  return (
    <dl className="-my-1.5">
      <PropertyRow label="Status">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />
          {label}
        </span>
      </PropertyRow>

      <PropertyRow label="Live version">
        {liveRelease ? (
          <a
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            href={liveRelease.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            v{liveRelease.version}
            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
          </a>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </PropertyRow>

      <PropertyRow label="Latest draft">
        {draftVersion == null ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          `v${draftVersion}`
        )}
      </PropertyRow>

      <PropertyRow label="Created">
        {createdAt ? formatDate(createdAt) : <span className="text-muted-foreground">Unknown</span>}
      </PropertyRow>

      <PropertyRow label="Slug">
        <span className="font-mono text-xs">{slug}</span>
      </PropertyRow>
    </dl>
  );
}
