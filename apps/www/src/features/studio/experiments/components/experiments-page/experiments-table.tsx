"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import type { RpcExperimentListItem } from "@voidhash/rpc";
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

import type { ExperimentMetrics } from "../../lib/experiment-metrics";
import { EXPERIMENT_STATUS, experimentStatusLabel } from "../../lib/experiment-status";

// Per-variant numbers need `$experiment.exposed` events, which are not emitted
// yet (see the SDK resolve path). Until they are, anything that has to be split
// by arm renders as an em-dash rather than a misleading zero.
const UNSPLIT_SUFFIX =
  " Not available yet — exposures aren't recorded per variant, so results can't be split by arm.";

interface MetricColumn {
  info: string;
  key: string;
  label: string;
  /** Reads a value off the row's metrics; absent while the metric is unavailable. */
  value?: (metrics: ExperimentMetrics) => string;
}

const METRIC_COLUMNS: MetricColumn[] = [
  {
    info: "Times a paywall was shown at the locations this test targets.",
    key: "views",
    label: "Views",
    value: (metrics) => metrics.views.toLocaleString(),
  },
  {
    info: "Distinct users who saw a paywall at the locations this test targets.",
    key: "viewers",
    label: "Unique viewers",
    value: (metrics) => metrics.viewers.toLocaleString(),
  },
  {
    info: "Purchases completed after seeing a paywall at the locations this test targets.",
    key: "purchases",
    label: "Purchases",
    value: (metrics) => metrics.purchases.toLocaleString(),
  },
  {
    info: "Share of viewers who went on to purchase within 7 days, across the test's locations.",
    key: "conversion",
    label: "Conversion",
    value: (metrics) => `${(metrics.conversion * 100).toFixed(1)}%`,
  },
  {
    info: `Conversion lift of the winning arm over control.${UNSPLIT_SUFFIX}`,
    key: "uplift",
    label: "Uplift",
  },
  {
    info: `Confidence that the observed difference between arms is real.${UNSPLIT_SUFFIX}`,
    key: "significance",
    label: "Significance",
  },
];

// The table is wider than its container, so the name column pins to the left
// edge while the metrics scroll past it. A pinned cell needs an opaque
// background of its own — the table's `bg-card` sits *below* the cells sliding
// underneath — and `isolate` + a `-z-10` overlay reproduces the row's
// translucent hover tint over that base without washing over the text.
const PINNED_START =
  "sticky isolate z-20 left-0 bg-card border-border/60 border-r after:absolute after:inset-0 after:-z-10 after:bg-muted/40 after:opacity-0 group-hover/row:after:opacity-100";

const STATUS_PRESENTATION: Record<number, { dotClassName: string }> = {
  [EXPERIMENT_STATUS.draft]: { dotClassName: "bg-muted-foreground/50" },
  [EXPERIMENT_STATUS.running]: { dotClassName: "bg-emerald-500" },
  [EXPERIMENT_STATUS.paused]: { dotClassName: "bg-amber-500" },
  [EXPERIMENT_STATUS.concluded]: { dotClassName: "bg-sky-500" },
};

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

export interface ExperimentsTableProps {
  experiments: readonly (typeof RpcExperimentListItem.Type)[];
  isMetricsPending: boolean;
  /** Metrics for a test's target locations, addressed by their slugs. */
  metricsFor: (locationSlugs: readonly string[]) => ExperimentMetrics;
  organizationSlug: string;
  /** Paywall-location slugs by id, for turning treatment targets into metric keys. */
  locationSlugsById: ReadonlyMap<string, string>;
  projectSlug: string;
}

/**
 * The A/B tests index: one row per test showing its lifecycle state, its setup,
 * and how the traffic it splits performs. Wide enough to scroll horizontally
 * rather than squeeze the metric columns.
 */
export function ExperimentsTable({
  experiments,
  isMetricsPending,
  locationSlugsById,
  metricsFor,
  organizationSlug,
  projectSlug,
}: ExperimentsTableProps) {
  return (
    <TooltipProvider>
      {/* `overscroll-x-contain` stops the scroll from chaining to the `<main>`
          element behind it, which is itself an x-scroller — without it, hitting
          either end rubber-bands the page and the pinned column jitters. */}
      <Table containerClassName="overflow-x-auto overscroll-x-contain">
        <TableHeader>
          <TableRow>
            <TableHead className={cn(PINNED_START, "min-w-56")}>A/B test</TableHead>
            <TableHead className="min-w-28">Status</TableHead>
            <TableHead className="min-w-24">Variants</TableHead>
            <TableHead className="min-w-24">Locations</TableHead>
            {METRIC_COLUMNS.map((column) => (
              <MetricHead column={column} key={column.key} />
            ))}
            <TableHead className="min-w-28 text-right">Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {experiments.map((experiment) => (
            <ExperimentsTableRow
              experiment={experiment}
              isMetricsPending={isMetricsPending}
              key={experiment.id}
              locationSlugsById={locationSlugsById}
              metricsFor={metricsFor}
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
            />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

interface ExperimentsTableRowProps {
  experiment: typeof RpcExperimentListItem.Type;
  isMetricsPending: boolean;
  locationSlugsById: ReadonlyMap<string, string>;
  metricsFor: (locationSlugs: readonly string[]) => ExperimentMetrics;
  organizationSlug: string;
  projectSlug: string;
}

const formatDate = (value: Date) =>
  value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ExperimentsTableRow({
  experiment,
  isMetricsPending,
  locationSlugsById,
  metricsFor,
  organizationSlug,
  projectSlug,
}: ExperimentsTableRowProps) {
  const navigate = useNavigate();
  const isArchived = experiment.archivedAt != null;
  const detailLink = {
    params: { id: experiment.id, organizationSlug, projectSlug },
    to: "/studio/$organizationSlug/$projectSlug/experiments/$id",
  } as const;

  const locationSlugs = experiment.paywallLocationIds
    .map((id) => locationSlugsById.get(id))
    .filter((slug): slug is string => slug !== undefined);
  const metrics = metricsFor(locationSlugs);

  const status = isArchived
    ? { dotClassName: "bg-muted-foreground/50", label: "Archived" }
    : {
        dotClassName:
          STATUS_PRESENTATION[experiment.status]?.dotClassName ?? "bg-muted-foreground/50",
        label: experimentStatusLabel(experiment.status),
      };
  // A test that hasn't been pointed at a location yet has no traffic to report,
  // which is different from a test whose locations simply saw none.
  const hasTargets = locationSlugs.length > 0;

  return (
    <TableRow
      className={cn("group/row cursor-pointer", isArchived && "opacity-60")}
      // The whole row opens the test. The name stays a real link so the row is
      // still keyboard-reachable and middle-clickable.
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) {
          return;
        }
        void navigate(detailLink);
      }}
    >
      <TableCell className={PINNED_START}>
        <div className="max-w-xs">
          <Link className="block truncate font-medium hover:underline" {...detailLink}>
            {experiment.name}
          </Link>
          {experiment.description ? (
            <p className="mt-0.5 truncate text-muted-foreground text-xs">
              {experiment.description}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 rounded-full", status.dotClassName)} />
          {status.label}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {experiment.variantCount}
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {hasTargets ? locationSlugs.length : "—"}
      </TableCell>

      {METRIC_COLUMNS.map((column) => (
        <TableCell className="text-right tabular-nums" key={column.key}>
          {!(column.value && hasTargets) ? (
            <span className="text-muted-foreground">—</span>
          ) : isMetricsPending ? (
            <Skeleton className="ml-auto h-4 w-10" />
          ) : (
            column.value(metrics)
          )}
        </TableCell>
      ))}

      <TableCell className="text-right text-muted-foreground">
        {experiment.startedAt ? formatDate(experiment.startedAt) : "—"}
      </TableCell>
    </TableRow>
  );
}
