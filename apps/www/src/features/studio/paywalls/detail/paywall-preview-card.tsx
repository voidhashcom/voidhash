"use client";

import type { Paywall } from "@voidhash/rpc";
import { Badge, Button, Card, CardContent } from "@voidhash/ui";
import { ExternalLinkIcon, Smartphone } from "lucide-react";

interface PaywallPreviewCardProps {
  liveRelease: { htmlUrl: string; version: number } | null;
  paywall: typeof Paywall.Type;
}

/**
 * Phone-frame preview of the paywall's latest rendered thumbnail, with a link
 * to the live HTML artifact when a released version is currently being shown.
 */
export function PaywallPreviewCard({ liveRelease, paywall }: PaywallPreviewCardProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
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
      <CardContent className="flex items-center justify-between px-4 py-3">
        {liveRelease ? (
          <>
            <Badge variant="secondary">Live · v{liveRelease.version}</Badge>
            <Button asChild size="sm" variant="ghost">
              <a href={liveRelease.htmlUrl} rel="noreferrer" target="_blank">
                View live
                <ExternalLinkIcon />
              </a>
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Not live at any location</span>
        )}
      </CardContent>
    </Card>
  );
}
