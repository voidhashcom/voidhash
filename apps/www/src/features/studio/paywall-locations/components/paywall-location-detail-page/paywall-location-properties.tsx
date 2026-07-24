"use client";

import type { RpcPaywallLocation } from "@voidhash/rpc";
import { cn } from "@voidhash/ui";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PaywallLocationPropertiesProps {
  location: typeof RpcPaywallLocation.Type;
  /**
   * Combobox trigger for the Paywall row, already bound to this location.
   * Omitted when the location can't be changed.
   */
  paywallCombobox?: ReactNode;
}

type LocationStatus = "archived" | "empty" | "live";

const STATUS_PRESENTATION: Record<LocationStatus, { dotClassName: string; label: string }> = {
  archived: { dotClassName: "bg-muted-foreground", label: "Archived" },
  empty: { dotClassName: "bg-muted-foreground/50", label: "Empty" },
  live: { dotClassName: "bg-emerald-500", label: "Live" },
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
 * Linear-style property list for the paywall location detail screen — whether
 * the location is serving anything, which paywall and release it currently
 * resolves to, and its identifiers.
 */
export function PaywallLocationProperties({
  location,
  paywallCombobox,
}: PaywallLocationPropertiesProps) {
  const showing = location.activeShowing;
  const status: LocationStatus =
    location.archivedAt != null ? "archived" : showing?.paywall ? "live" : "empty";
  const { dotClassName, label } = STATUS_PRESENTATION[status];

  return (
    <dl className="-my-1.5">
      <PropertyRow label="Status">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />
          {label}
        </span>
      </PropertyRow>

      <PropertyRow label="Paywall">
        {paywallCombobox ??
          (showing?.paywall ? (
            <span className="truncate">{showing.paywall.name}</span>
          ) : (
            <span className="text-muted-foreground">None</span>
          ))}
      </PropertyRow>

      <PropertyRow label="Live version">
        {showing?.paywallRelease ? (
          <a
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            href={showing.paywallRelease.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            v{showing.paywallRelease.version}
            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
          </a>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </PropertyRow>

      <PropertyRow label="Description">
        {location.description ? (
          location.description
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </PropertyRow>

      <PropertyRow label="Created">
        {location.createdAt ? (
          formatDate(location.createdAt)
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        )}
      </PropertyRow>

      <PropertyRow label="Slug">
        <span className="font-mono text-xs">{location.slug}</span>
      </PropertyRow>
    </dl>
  );
}
