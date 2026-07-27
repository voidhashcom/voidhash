"use client";

import { Button } from "@voidhash/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voidhash/ui/empty";
import { MapPin } from "lucide-react";
import { useState } from "react";

import { CreatePaywallLocationModal } from "./create-paywall-location-modal";

/** Empty state for the paywall locations settings list. */
export function PaywallLocationsPageEmptyState({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Empty className="mx-auto w-full max-w-xl">
      <EmptyMedia variant="icon">
        <MapPin />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>Name your first location</EmptyTitle>
        <EmptyDescription>
          Locations are the places your app asks for a paywall — onboarding, settings, a locked
          feature. Point one at a paywall and swap it later without shipping a release.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreatePaywallLocationModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          projectId={projectId}
          trigger={<Button onClick={() => setOpen(true)}>Add location</Button>}
        />
      </EmptyContent>
    </Empty>
  );
}
