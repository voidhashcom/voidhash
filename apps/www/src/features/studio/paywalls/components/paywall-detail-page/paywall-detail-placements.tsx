"use client";

import type { RpcPaywallLocation } from "@voidhash/rpc";
import { Button } from "@voidhash/ui";
import { MapPinIcon, PlusIcon } from "lucide-react";

import { PaywallLocationCombobox } from "./paywall-location-combobox";

export interface PaywallDetailPlacementsProps {
  locations: readonly (typeof RpcPaywallLocation.Type)[];
  paywallId: string;
  projectId: string;
}

/**
 * Placements section of the paywall detail page: the locations currently
 * showing this paywall, plus an add button that opens the location picker.
 * With no placements yet the section collapses to a single labelled add
 * button — a bare "Placements" heading over an empty list says nothing.
 */
export function PaywallDetailPlacements({
  locations,
  paywallId,
  projectId,
}: PaywallDetailPlacementsProps) {
  const placements = locations.filter(
    (location) => location.activeShowing?.paywallId === paywallId,
  );

  return (
    <section className="space-y-3">
      {placements.length === 0 ? (
        <PaywallLocationCombobox
          locations={locations}
          paywallId={paywallId}
          projectId={projectId}
          trigger={
            <Button className="-ml-2.5 text-muted-foreground" variant="ghost">
              <PlusIcon />
              Place at a paywall location
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium text-sm">Placements</h2>
            <PaywallLocationCombobox
              locations={locations}
              paywallId={paywallId}
              projectId={projectId}
              trigger={
                <Button aria-label="Add placement" size="icon-sm" variant="ghost">
                  <PlusIcon />
                </Button>
              }
            />
          </div>

          <ul className="divide-y divide-border/60 border-border/60 border-y">
            {placements.map((location) => (
              <li className="flex items-center justify-between gap-3 py-2.5" key={location.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{location.name}</span>
                  <span className="truncate font-mono text-muted-foreground text-xs">
                    {location.slug}
                  </span>
                </span>
                {location.activeShowing?.paywallRelease && (
                  <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                    v{location.activeShowing.paywallRelease.version}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
