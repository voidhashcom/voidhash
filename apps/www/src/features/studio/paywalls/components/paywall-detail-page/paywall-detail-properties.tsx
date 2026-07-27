"use client";

import { ExternalLinkIcon } from "lucide-react";

import {
  formatPropertyDate,
  PropertyCopyValue,
  PropertyEmpty,
  PropertyLink,
  PropertyList,
  PropertyRow,
  PropertyStatusDot,
  PropertyValue,
} from "@/features/studio/components/property-list";

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

/**
 * Property list for the paywall detail screen — status, which versions are
 * live and drafted, and its identifiers.
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
    <PropertyList>
      <PropertyRow label="Status">
        <PropertyValue>
          <PropertyStatusDot className={dotClassName} />
          {label}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Live version">
        {liveRelease ? (
          <PropertyLink href={liveRelease.htmlUrl}>
            v{liveRelease.version}
            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
          </PropertyLink>
        ) : (
          <PropertyValue>
            <PropertyEmpty>None</PropertyEmpty>
          </PropertyValue>
        )}
      </PropertyRow>

      <PropertyRow label="Latest draft">
        <PropertyValue>
          {draftVersion == null ? <PropertyEmpty>None</PropertyEmpty> : `v${draftVersion}`}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Created">
        <PropertyValue>
          {createdAt ? formatPropertyDate(createdAt) : <PropertyEmpty>Unknown</PropertyEmpty>}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Slug">
        <PropertyCopyValue label="Slug" value={slug} />
      </PropertyRow>
    </PropertyList>
  );
}
