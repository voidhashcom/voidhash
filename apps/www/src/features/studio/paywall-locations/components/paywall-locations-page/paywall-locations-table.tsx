"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import type { Paywall, RpcPaywallLocation } from "@voidhash/rpc";
import {
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@voidhash/ui";
import { CircleHelpIcon } from "lucide-react";

import type { PaywallLocationMetrics } from "../../lib/paywall-location-metrics";
import { PaywallLocationActionsMenu } from "../shared/paywall-location-actions-menu";
import { PaywallLocationPaywallCell } from "./paywall-location-paywall-cell";

// Money-carrying events are emitted server-side from provider webhooks and
// carry no paywall identity, so none of these can be scoped to a location yet.
// They render as em-dashes until the attribution work in
// docs/paywall-revenue-attribution.md lands.
const UNATTRIBUTED_SUFFIX =
  " Not available yet — revenue events aren't attributed to a paywall location.";

interface MetricColumn {
  info: string;
  key: string;
  label: string;
  /** Reads a value off the row's metrics; absent while unattributed. */
  value?: (metrics: PaywallLocationMetrics) => string;
}

const METRIC_COLUMNS: MetricColumn[] = [
  {
    info: `Gross amount charged to customers, before store commission and tax.${UNATTRIBUTED_SUFFIX}`,
    key: "revenue",
    label: "Revenue",
  },
  {
    info: `Revenue after the app store's commission.${UNATTRIBUTED_SUFFIX}`,
    key: "proceeds",
    label: "Proceeds",
  },
  {
    info: `Proceeds after both store commission and tax.${UNATTRIBUTED_SUFFIX}`,
    key: "netProceeds",
    label: "Net proceeds",
  },
  {
    info: "Times a paywall was shown at this location.",
    key: "views",
    label: "Views",
    value: (metrics) => metrics.views.toLocaleString(),
  },
  {
    info: "Distinct users who saw a paywall at this location.",
    key: "viewers",
    label: "Unique viewers",
    value: (metrics) => metrics.viewers.toLocaleString(),
  },
  {
    info: "Purchases completed after seeing a paywall at this location.",
    key: "purchases",
    label: "Purchases",
    value: (metrics) => metrics.purchases.toLocaleString(),
  },
  {
    info: "Share of viewers who went on to purchase within 7 days.",
    key: "conversion",
    label: "Conversion",
    value: (metrics) => `${(metrics.conversion * 100).toFixed(1)}%`,
  },
  {
    info: `Free trials started from this location.${UNATTRIBUTED_SUFFIX}`,
    key: "trials",
    label: "Trials",
  },
  {
    info: `Purchases from this location that were later refunded.${UNATTRIBUTED_SUFFIX}`,
    key: "refunds",
    label: "Refunds",
  },
];

// `TooltipRoot` (not `Tooltip`) because the header mounts one per metric column
// and they share the single provider wrapping the header row.
function MetricHead({ column }: { column: MetricColumn }) {
  return (
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1.5">
        <TooltipRoot>
          <TooltipTrigger className="cursor-help">
            <CircleHelpIcon className="size-3.5 opacity-60" />
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{column.info}</TooltipContent>
        </TooltipRoot>
        {column.label}
      </span>
    </TableHead>
  );
}

// The table is wider than its container, so the name and actions columns pin to
// the edges while the metrics scroll between them. Pinned cells need an opaque
// background of their own — the table's own `bg-card` sits *below* the cells
// that scroll underneath, so a transparent pinned cell would show them through.
// `isolate` + a `-z-10` overlay reproduces the row's translucent hover tint over
// that opaque base without washing over the cell's text.
const PINNED_CELL =
  "sticky isolate z-20 bg-card after:absolute after:inset-0 after:-z-10 after:bg-muted/40 after:opacity-0 group-hover/row:after:opacity-100";
const PINNED_START = `${PINNED_CELL} left-0 border-border/60 border-r`;
const PINNED_END = `${PINNED_CELL} right-0 border-border/60 border-l`;

type ActivationState = "archived" | "empty" | "live";

const ACTIVATION_PRESENTATION: Record<ActivationState, { dotClassName: string; label: string }> = {
  archived: { dotClassName: "bg-muted-foreground/50", label: "Archived" },
  empty: { dotClassName: "bg-muted-foreground/50", label: "Empty" },
  live: { dotClassName: "bg-emerald-500", label: "Live" },
};

export interface PaywallLocationsTableProps {
  isMetricsPending: boolean;
  locations: readonly (typeof RpcPaywallLocation.Type)[];
  metricsFor: (locationSlug: string) => PaywallLocationMetrics;
  organizationSlug: string;
  /** Full paywall records by id, for the hover preview's thumbnail. */
  paywallsById: ReadonlyMap<string, typeof Paywall.Type>;
  projectSlug: string;
}

/**
 * The paywall locations index: one row per location showing what it serves and
 * how that placement performs. Wide enough to scroll horizontally rather than
 * squeeze the metric columns.
 */
export function PaywallLocationsTable({
  isMetricsPending,
  locations,
  metricsFor,
  organizationSlug,
  paywallsById,
  projectSlug,
}: PaywallLocationsTableProps) {
  return (
    // One provider for the whole header — mounted outside the table so it never
    // introduces a node between <thead> and <tr>.
    <TooltipProvider>
      {/* `overscroll-x-contain` stops the scroll from chaining to the `<main>`
          element behind it, which is itself an x-scroller — without it, hitting
          either end rubber-bands the page and the pinned columns jitter. */}
      <Table containerClassName="overflow-x-auto overscroll-x-contain">
        <TableHeader>
          <TableRow>
            <TableHead className={cn(PINNED_START, "min-w-44")}>Paywall location</TableHead>
            <TableHead className="min-w-32">Slug</TableHead>
            <TableHead className="min-w-40">Paywall</TableHead>
            {METRIC_COLUMNS.map((column) => (
              <MetricHead column={column} key={column.key} />
            ))}
            <TableHead>Activation state</TableHead>
            <TableHead className={cn(PINNED_END, "w-0")} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <PaywallLocationsTableRow
              isMetricsPending={isMetricsPending}
              key={location.id}
              location={location}
              metrics={metricsFor(location.slug)}
              organizationSlug={organizationSlug}
              paywallsById={paywallsById}
              projectSlug={projectSlug}
            />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

interface PaywallLocationsTableRowProps {
  isMetricsPending: boolean;
  location: typeof RpcPaywallLocation.Type;
  metrics: PaywallLocationMetrics;
  organizationSlug: string;
  paywallsById: ReadonlyMap<string, typeof Paywall.Type>;
  projectSlug: string;
}

function PaywallLocationsTableRow({
  isMetricsPending,
  location,
  metrics,
  organizationSlug,
  paywallsById,
  projectSlug,
}: PaywallLocationsTableRowProps) {
  const navigate = useNavigate();
  const isArchived = location.archivedAt != null;
  const showingPaywallId = location.activeShowing?.paywallId;
  const showingPaywall = showingPaywallId == null ? undefined : paywallsById.get(showingPaywallId);
  const activation: ActivationState = isArchived ? "archived" : showingPaywall ? "live" : "empty";
  const { dotClassName, label } = ACTIVATION_PRESENTATION[activation];
  const detailLink = {
    params: { id: location.id, organizationSlug, projectSlug },
    to: "/studio/$organizationSlug/$projectSlug/settings/paywall-locations/$id",
  } as const;

  return (
    <TableRow
      className={cn("group/row cursor-pointer", isArchived && "opacity-60")}
      // The whole row opens the location. The name stays a real link so the row
      // is still keyboard-reachable and middle-clickable; the paywall link and
      // the kebab menu own their own clicks, so anything nested opts out here.
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) {
          return;
        }
        void navigate(detailLink);
      }}
    >
      <TableCell className={PINNED_START}>
        <Link className="font-medium hover:underline" {...detailLink}>
          {location.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground text-xs">{location.slug}</TableCell>
      <TableCell>
        {showingPaywall ? (
          <PaywallLocationPaywallCell
            organizationSlug={organizationSlug}
            paywall={showingPaywall}
            projectSlug={projectSlug}
            releaseVersion={location.activeShowing?.paywallRelease?.version}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {METRIC_COLUMNS.map((column) => (
        <TableCell className="text-right tabular-nums" key={column.key}>
          {!column.value ? (
            <span className="text-muted-foreground">—</span>
          ) : isMetricsPending ? (
            <Skeleton className="ml-auto h-4 w-10" />
          ) : (
            column.value(metrics)
          )}
        </TableCell>
      ))}

      <TableCell>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 rounded-full", dotClassName)} />
          {label}
        </span>
      </TableCell>
      <TableCell className={cn(PINNED_END, "text-right")}>
        <PaywallLocationActionsMenu location={location} />
      </TableCell>
    </TableRow>
  );
}
