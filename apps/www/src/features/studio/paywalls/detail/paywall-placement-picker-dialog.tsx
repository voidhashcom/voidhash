"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RpcPaywallLocation } from "@voidhash/rpc";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voidhash/ui";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import {
  assignPaywallLocationShowingOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

export interface PaywallPlacementPickerDialogProps {
  locations: readonly (typeof RpcPaywallLocation.Type)[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  paywallId: string;
  projectId: string;
}

/**
 * Command palette that lists every paywall location in the project. Picking one
 * points that location at this paywall, replacing whatever it was showing —
 * a location serves exactly one paywall at a time.
 */
export function PaywallPlacementPickerDialog({
  locations,
  onOpenChange,
  open,
  paywallId,
  projectId,
}: PaywallPlacementPickerDialogProps) {
  const queryClient = useQueryClient();

  const { mutate: assignShowing, status } = useMutation({
    ...assignPaywallLocationShowingOptions(),
    onError: (error) => {
      toast.error(
        error._tag === "EffectQueryFailure"
          ? error.match({
              "Rpc/ActionForbiddenError": (failure) => failure.message,
              "Rpc/PaywallLocationNotFoundError": (failure) => failure.message,
              "Rpc/PaywallLocationShowingValidationError": (failure) => failure.message,
              "Rpc/PaywallNotFoundError": (failure) => failure.message,
              OrElse: () => "Failed to add placement",
            })
          : "Failed to add placement",
      );
    },
    onSuccess: async (_, variables) => {
      toast.success("Placement added");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.list({ projectId }),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.showings({ locationId: variables.locationId }),
      });
      onOpenChange(false);
    },
  });

  const isPending = status === "pending";

  return (
    <CommandDialog
      description="Pick a location to show this paywall at."
      onOpenChange={(next) => {
        if (!isPending) {
          onOpenChange(next);
        }
      }}
      open={open}
      title="Add placement"
    >
      <CommandInput placeholder="Search locations..." />
      <CommandList>
        <CommandEmpty>No locations found.</CommandEmpty>
        <CommandGroup heading="Locations">
          {locations.map((location) => {
            const isCurrent = location.activeShowing?.paywallId === paywallId;
            const showingName = location.activeShowing?.paywall?.name;

            return (
              <CommandItem
                disabled={isPending}
                key={location.id}
                onSelect={() => {
                  if (isCurrent) {
                    onOpenChange(false);
                    return;
                  }
                  assignShowing({
                    locationId: location.id,
                    paywallId,
                    type: "paywall_release",
                  });
                }}
                value={`${location.name} ${location.slug}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{location.name}</span>
                    <span className="truncate font-mono text-muted-foreground text-xs">
                      {location.slug}
                    </span>
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {isCurrent
                      ? "Already showing this paywall"
                      : showingName
                        ? `Currently showing ${showingName}`
                        : "Empty"}
                  </span>
                </div>
                {isCurrent && <CheckIcon className="shrink-0" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
