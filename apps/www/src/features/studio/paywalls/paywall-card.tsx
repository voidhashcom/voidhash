"use client";

import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";
import { Badge } from "@voidhash/ui";
import { Smartphone } from "lucide-react";

import { PaywallActionsMenu } from "./paywall-actions-menu";

interface PaywallCardProps {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
}

/**
 * A single paywall tile in the dashboard grid: a link to the paywall detail
 * page plus a kebab menu with Edit (straight into the designer) / Rename /
 * Archive (or Restore) / Delete. Archived paywalls are dimmed and badged.
 */
export function PaywallCard({ paywall, organizationSlug, projectSlug }: PaywallCardProps) {
  const isArchived = paywall.archivedAt != null;

  return (
    <div className="group relative">
      <Link
        className={`flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-foreground/20 hover:shadow-lg ${
          isArchived ? "opacity-60" : ""
        }`}
        params={{ id: paywall.id, organizationSlug, projectSlug }}
        to="/studio/$organizationSlug/$projectSlug/paywalls/$id"
      >
        {/* Preview Area */}
        <div className="relative flex aspect-[246/278] items-center justify-center overflow-hidden bg-linear-150 from-blue-ribbon-950 to-electric-violet-950">
          {paywall.thumbnailUrl && (
            <img
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full scale-125 object-cover blur-[32px]"
              loading="lazy"
              src={paywall.thumbnailUrl}
            />
          )}

          <div className="relative z-10 aspect-[532/1119] h-[86.34%] overflow-hidden rounded-[12px] bg-zinc-950 shadow-[inset_0_0_4px_rgb(255_255_255/0.13)] ring-1 ring-inset ring-zinc-800">
            <div className="absolute inset-x-[2.26%] inset-y-[1.16%] flex items-center justify-center overflow-hidden rounded-[10px] bg-zinc-950">
              {paywall.thumbnailUrl ? (
                <img
                  alt={paywall.name}
                  className="size-full object-cover object-top"
                  loading="lazy"
                  src={paywall.thumbnailUrl}
                />
              ) : (
                <Smartphone className="h-10 w-10 text-zinc-400 opacity-30" />
              )}
            </div>
          </div>
        </div>

        {/* Info Area */}
        <div className="px-4 py-3.5">
          <h3 className="truncate font-medium text-sm">{paywall.name}</h3>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {paywall.slug}
          </p>
        </div>
      </Link>

      {isArchived && (
        <Badge className="absolute top-2 left-2" variant="secondary">
          Archived
        </Badge>
      )}

      <div className="absolute top-2 right-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <PaywallActionsMenu
          organizationSlug={organizationSlug}
          paywall={paywall}
          projectSlug={projectSlug}
          triggerClassName="size-7 bg-background/80 backdrop-blur-sm"
          triggerVariant="secondary"
        />
      </div>
    </div>
  );
}
