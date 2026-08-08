"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import type { RpcFeatureFlagListItem } from "@voidhash/rpc";
import { Badge, cn, TableCell, TableRow } from "@voidhash/ui";
import { FlaskConical } from "lucide-react";

import { FlagTypeIndicator } from "../shared/flag-type-indicator";

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
 * A feature-flag table row linking to its detail page and surfacing the flag's
 * type, allocation, lifecycle state, and last change.
 */
export function FlagRecord({
  flag,
  organizationSlug,
  projectSlug,
}: {
  flag: typeof RpcFeatureFlagListItem.Type;
  organizationSlug: string;
  projectSlug: string;
}) {
  const navigate = useNavigate();
  const detailLink = {
    params: { id: flag.id, organizationSlug, projectSlug },
    to: "/studio/$organizationSlug/$projectSlug/flags/$id",
  } as const;
  const isArchived = flag.archivedAt != null;
  const status = isArchived
    ? { dotClassName: "bg-muted-foreground/50", label: "Archived" }
    : flag.enabled
      ? { dotClassName: "bg-emerald-500", label: "Enabled" }
      : { dotClassName: "bg-muted-foreground/50", label: "Disabled" };

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
          <div className="flex items-center gap-2">
            <Link className="truncate font-medium hover:underline" {...detailLink}>
              {flag.slug}
            </Link>
            {flag.internal ? (
              <Badge variant="outline">
                <FlaskConical className="mr-1 size-3" />
                Internal
              </Badge>
            ) : null}
          </div>
          {flag.description ? (
            <p className="mt-0.5 truncate text-muted-foreground text-xs">{flag.description}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <FlagTypeIndicator flagType={flag.type} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {flag.variantCount === 0
          ? `${(flag.rolloutBps / 100).toFixed(0)}% rollout`
          : `${flag.variantCount} variant${flag.variantCount === 1 ? "" : "s"}`}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <span className={cn("size-2 rounded-full", status.dotClassName)} />
          {status.label}
        </span>
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatDate(flag.updatedAt ?? flag.createdAt)}
      </TableCell>
    </TableRow>
  );
}
