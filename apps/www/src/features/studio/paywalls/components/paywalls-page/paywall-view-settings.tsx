"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { Effect } from "effect";
import { LayoutGridIcon, Rows3Icon, Settings2Icon } from "lucide-react";

const STORAGE_KEY = "voidhash.paywalls.view";

/** How the paywall dashboard renders its list: a card grid or a compact table. */
export type PaywallView = "grid" | "table";

/** Load the persisted dashboard view, tolerating missing/corrupt storage. */
export function loadPaywallView(): PaywallView {
  if (typeof window === "undefined") {
    return "grid";
  }
  return Effect.runSync(
    Effect.try((): PaywallView => {
      if (window.localStorage.getItem(STORAGE_KEY) === "table") {
        return "table";
      }
      return "grid";
    }).pipe(Effect.orElseSucceed((): PaywallView => "grid")),
  );
}

/** Persist the chosen dashboard view so it survives reloads. */
export function persistPaywallView(view: PaywallView): void {
  if (typeof window === "undefined") {
    return;
  }
  // Storage may be unavailable (private mode, quota) — the choice just won't persist.
  Effect.runSync(
    Effect.try(() => {
      window.localStorage.setItem(STORAGE_KEY, view);
    }).pipe(Effect.ignore),
  );
}

interface PaywallViewSettingsProps {
  view: PaywallView;
  onViewChange: (view: PaywallView) => void;
}

/**
 * Settings dropdown for the paywall dashboard exposing the layout toggle
 * (grid vs. table). The active layout is always checked and cannot be
 * unchecked — picking either option just switches to it.
 */
export function PaywallViewSettings({ view, onViewChange }: PaywallViewSettingsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="View settings" size="icon-sm" variant="ghost">
          <Settings2Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={view === "grid"}
          onCheckedChange={() => onViewChange("grid")}
        >
          <LayoutGridIcon />
          Grid
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={view === "table"}
          onCheckedChange={() => onViewChange("table")}
        >
          <Rows3Icon />
          Table
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
