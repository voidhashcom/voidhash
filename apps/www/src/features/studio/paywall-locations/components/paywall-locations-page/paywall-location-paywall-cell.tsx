"use client";

import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";
import { HoverCard, HoverCardContent, HoverCardTrigger, Phone } from "@voidhash/ui";
import { SmartphoneIcon } from "lucide-react";

interface PaywallLocationPaywallCellProps {
  organizationSlug: string;
  /**
   * The full paywall record — `activeShowing.paywall` carries only id/name/slug,
   * so the thumbnail has to come from the project's paywall list.
   */
  paywall: typeof Paywall.Type;
  projectSlug: string;
  releaseVersion?: null | number;
}

/**
 * The paywall a location currently serves, rendered as a link to that paywall's
 * detail page. Hovering reveals a phone-framed thumbnail so the whole index can
 * be scanned by name without giving every row the vertical space of a preview.
 */
export function PaywallLocationPaywallCell({
  organizationSlug,
  paywall,
  projectSlug,
  releaseVersion,
}: PaywallLocationPaywallCellProps) {
  return (
    <HoverCard closeDelay={80} openDelay={160}>
      <HoverCardTrigger asChild>
        <Link
          className="inline-flex max-w-56 items-baseline gap-2 truncate hover:underline"
          params={{ id: paywall.id, organizationSlug, projectSlug }}
          to="/studio/$organizationSlug/$projectSlug/paywalls/$id"
        >
          <span className="truncate">{paywall.name}</span>
          {releaseVersion != null && (
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
              v{releaseVersion}
            </span>
          )}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-52 p-2" side="right">
        <Phone className="w-full" screenClassName="flex items-center justify-center bg-zinc-950">
          {paywall.thumbnailUrl ? (
            <img
              alt={paywall.name}
              className="size-full object-cover object-top"
              loading="lazy"
              src={paywall.thumbnailUrl}
            />
          ) : (
            <SmartphoneIcon className="size-8 text-zinc-400 opacity-30" />
          )}
        </Phone>
      </HoverCardContent>
    </HoverCard>
  );
}
