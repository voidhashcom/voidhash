"use client";

import type { RpcPaywallLocation } from "@voidhash/rpc";
import { Button, cn } from "@voidhash/ui";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";

import {
  formatPropertyDate,
  PROPERTY_VALUE_CLASS_NAME,
  PropertyCopyValue,
  PropertyEmpty,
  PropertyLink,
  PropertyList,
  PropertyRow,
  PropertyStatusDot,
  PropertyValue,
} from "@/features/studio/components/property-list";

import { PaywallCombobox } from "../shared/paywall-combobox";

interface PaywallLocationPropertiesProps {
  location: typeof RpcPaywallLocation.Type;
  projectId: string;
  /** Archived locations can't be re-pointed, so the paywall row goes static. */
  readOnly?: boolean;
}

type LocationStatus = "archived" | "empty" | "live";

const STATUS_PRESENTATION: Record<LocationStatus, { dotClassName: string; label: string }> = {
  archived: { dotClassName: "bg-muted-foreground", label: "Archived" },
  empty: { dotClassName: "bg-muted-foreground/50", label: "Empty" },
  live: { dotClassName: "bg-emerald-500", label: "Live" },
};

/**
 * Property list for the paywall location detail screen — whether the location
 * is serving anything, which paywall and release it currently resolves to, and
 * its identifiers. The paywall row is repointed in place through the combobox.
 */
export function PaywallLocationProperties({
  location,
  projectId,
  readOnly,
}: PaywallLocationPropertiesProps) {
  const showing = location.activeShowing;
  const paywall = showing?.paywall ?? null;
  const status: LocationStatus =
    location.archivedAt != null ? "archived" : paywall ? "live" : "empty";
  const { dotClassName, label } = STATUS_PRESENTATION[status];

  return (
    <PropertyList>
      <PropertyRow label="Status">
        <PropertyValue>
          <PropertyStatusDot className={dotClassName} />
          {label}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Paywall">
        {readOnly ? (
          <PropertyValue>
            {paywall ? (
              <span className="min-w-0 truncate">{paywall.name}</span>
            ) : (
              <PropertyEmpty>None</PropertyEmpty>
            )}
          </PropertyValue>
        ) : (
          <PaywallCombobox
            currentPaywallId={showing?.paywallId}
            locationId={location.id}
            projectId={projectId}
            trigger={
              <Button
                aria-label="Change paywall"
                className={cn(
                  PROPERTY_VALUE_CLASS_NAME,
                  "max-w-full",
                  !paywall && "text-muted-foreground",
                )}
                size="sm"
                variant="ghost"
              >
                {paywall ? (
                  <span className="min-w-0 truncate">{paywall.name}</span>
                ) : (
                  <>
                    <PlusIcon />
                    Select a paywall...
                  </>
                )}
              </Button>
            }
          />
        )}
      </PropertyRow>

      <PropertyRow label="Live version">
        {showing?.paywallRelease ? (
          <PropertyLink href={showing.paywallRelease.htmlUrl}>
            v{showing.paywallRelease.version}
            <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
          </PropertyLink>
        ) : (
          <PropertyValue>
            <PropertyEmpty>None</PropertyEmpty>
          </PropertyValue>
        )}
      </PropertyRow>

      <PropertyRow label="Description">
        <PropertyValue>
          {location.description ? location.description : <PropertyEmpty>None</PropertyEmpty>}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Created">
        <PropertyValue>
          {location.createdAt ? (
            formatPropertyDate(location.createdAt)
          ) : (
            <PropertyEmpty>Unknown</PropertyEmpty>
          )}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Slug">
        <PropertyCopyValue label="Slug" value={location.slug} />
      </PropertyRow>
    </PropertyList>
  );
}
