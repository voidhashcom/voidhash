"use client";
import { Link } from "@tanstack/react-router";
import type { RpcExperimentListItem } from "@voidhash/rpc";
import { Badge } from "@voidhash/ui";

import { ExperimentStatusBadge } from "./experiment-status-badge";

/**
 * A single experiment row in the A/B tests list. Links to the experiment detail
 * page and surfaces the variant count and lifecycle status.
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
  return (
    <Link
      className="group relative isolate flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-accent/30"
      params={{ id: experiment.id, organizationSlug, projectSlug }}
      to="/studio/$organizationSlug/$projectSlug/experiments/$id"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{experiment.name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <code className="text-muted-foreground text-xs">{experiment.key}</code>
          {experiment.description && (
            <>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="truncate text-muted-foreground text-xs">
                {experiment.description}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {experiment.variantCount} variant{experiment.variantCount === 1 ? "" : "s"}
        </span>
        <ExperimentStatusBadge status={experiment.status} />
        {experiment.archivedAt && <Badge variant="outline">Archived</Badge>}
      </div>
    </Link>
  );
}
