"use client";
import { Link } from "@tanstack/react-router";
import type { RpcFeatureFlagListItem } from "@voidhash/rpc";
import { Badge } from "@voidhash/ui";
import { FlaskConical } from "lucide-react";

import { FlagTypeBadgeFromCount } from "./flag-type-badge";

/**
 * A single feature-flag row in the flags list. Links to the flag detail page and
 * surfaces the flag's type, rollout / variant summary, and enabled state.
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
  return (
    <Link
      className="group relative isolate flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-accent/30"
      params={{ id: flag.id, organizationSlug, projectSlug }}
      to="/studio/$organizationSlug/$projectSlug/flags/$id"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{flag.name}</span>
          {flag.internal && (
            <Badge variant="outline">
              <FlaskConical className="mr-1 h-3 w-3" />
              Internal
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <code className="text-muted-foreground text-xs">{flag.key}</code>
          {flag.description && (
            <>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="truncate text-muted-foreground text-xs">{flag.description}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <FlagTypeBadgeFromCount variantCount={flag.variantCount} />
        {flag.variantCount === 0 ? (
          <span className="text-muted-foreground text-sm">
            {(flag.rolloutBps / 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            {flag.variantCount} variant{flag.variantCount === 1 ? "" : "s"}
          </span>
        )}
        <Badge variant={flag.enabled ? "default" : "secondary"}>
          {flag.enabled ? "Enabled" : "Disabled"}
        </Badge>
        {flag.archivedAt && <Badge variant="outline">Archived</Badge>}
      </div>
    </Link>
  );
}
