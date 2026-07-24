"use client";

import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

import { EXPERIMENT_STATUS, experimentStatusLabel } from "../../lib/experiment-status";

interface ExperimentDetailPropertiesProps {
  archivedAt: Date | null;
  createdAt: Date | null;
  endedAt: Date | null;
  primaryMetricEventName: string | null;
  startedAt: Date | null;
  status: number;
  variantCount: number;
  version: number;
}

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
 * Linear property list for an A/B test's lifecycle, measurement, and stable
 * identifiers.
 */
export function ExperimentDetailProperties({
  archivedAt,
  createdAt,
  endedAt,
  primaryMetricEventName,
  startedAt,
  status,
  variantCount,
  version,
}: ExperimentDetailPropertiesProps) {
  const statusPresentation = archivedAt
    ? { dotClassName: "bg-muted-foreground", label: "Archived" }
    : status === EXPERIMENT_STATUS.running
      ? { dotClassName: "bg-emerald-500", label: experimentStatusLabel(status) }
      : status === EXPERIMENT_STATUS.paused
        ? { dotClassName: "bg-amber-500", label: experimentStatusLabel(status) }
        : { dotClassName: "bg-muted-foreground/50", label: experimentStatusLabel(status) };

  return (
    <dl className="-my-1.5">
      <PropertyRow label="Status">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", statusPresentation.dotClassName)}
          />
          {statusPresentation.label}
        </span>
      </PropertyRow>

      <PropertyRow label="Primary metric">
        {primaryMetricEventName ? (
          <span className="font-mono text-xs">{primaryMetricEventName}</span>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        )}
      </PropertyRow>

      <PropertyRow label="Variants">
        {variantCount} variant{variantCount === 1 ? "" : "s"}
      </PropertyRow>

      <PropertyRow label="Started">
        {startedAt ? formatDate(startedAt) : <span className="text-muted-foreground">Not yet</span>}
      </PropertyRow>

      <PropertyRow label="Ended">
        {endedAt ? formatDate(endedAt) : <span className="text-muted-foreground">Not yet</span>}
      </PropertyRow>

      <PropertyRow label="Created">
        {createdAt ? formatDate(createdAt) : <span className="text-muted-foreground">Unknown</span>}
      </PropertyRow>

      <PropertyRow label="Version">v{version}</PropertyRow>
    </dl>
  );
}
