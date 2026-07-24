"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import type { RpcExperimentListItem } from "@voidhash/rpc";
import { Badge, cn, TableCell, TableRow } from "@voidhash/ui";

import { ExperimentStatusBadge } from "../shared/experiment-status-badge";

function formatDate(value: Date | null): string {
  return value
    ? value.toLocaleDateString("en", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      })
    : "—";
}

/**
 * An A/B-test table row linking to its detail page and surfacing the primary
 * metric, variant count, lifecycle status, and last change.
 */
export function ExperimentRecord({
  experiment,
  organizationSlug,
  projectSlug,
}: {
  experiment: typeof RpcExperimentListItem.Type;
  organizationSlug: string;
  projectSlug: string;
}) {
  const navigate = useNavigate();
  const detailLink = {
    params: { id: experiment.id, organizationSlug, projectSlug },
    to: "/studio/$organizationSlug/$projectSlug/experiments/$id",
  } as const;
  const isArchived = experiment.archivedAt != null;

  return (
    <TableRow
      className={cn("cursor-pointer", isArchived && "opacity-60")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) {
          return;
        }
        void navigate(detailLink);
      }}
    >
      <TableCell className="min-w-64">
        <div className="max-w-sm">
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
      <TableCell className="font-mono text-muted-foreground text-xs">{experiment.key}</TableCell>
      <TableCell className="font-mono text-muted-foreground text-xs">
        {experiment.primaryMetricEventName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {experiment.variantCount} variant{experiment.variantCount === 1 ? "" : "s"}
      </TableCell>
      <TableCell>
        {isArchived ? (
          <Badge variant="outline">Archived</Badge>
        ) : (
          <ExperimentStatusBadge status={experiment.status} />
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatDate(experiment.updatedAt ?? experiment.createdAt)}
      </TableCell>
    </TableRow>
  );
}
