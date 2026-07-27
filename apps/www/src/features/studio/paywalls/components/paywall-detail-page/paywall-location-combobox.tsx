"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RpcPaywallLocation } from "@voidhash/rpc";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@voidhash/ui";
import { type ReactElement, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  assignPaywallLocationShowingOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

export interface PaywallLocationComboboxProps {
  locations: readonly (typeof RpcPaywallLocation.Type)[];
  paywallId: string;
  projectId: string;
  /** Inline element that opens the popup. */
  trigger: ReactElement;
}

/**
 * Combobox listing every paywall location in the project. Picking one points
 * that location at this paywall, replacing whatever it was showing.
 */
export function PaywallLocationCombobox({
  locations,
  paywallId,
  projectId,
  trigger,
}: PaywallLocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
    }
  };

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return locations;
    }
    return locations.filter((location) =>
      `${location.name} ${location.slug}`.toLowerCase().includes(needle),
    );
  }, [locations, query]);

  const queryClient = useQueryClient();
  const { mutate: assignShowing } = useMutation({
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
      changeOpen(false);
    },
  });

  return (
    // The search text is driven through the root's `inputValue` rather than the
    // input element — Base UI owns that input's value, so controlling the
    // element directly fights it. No `items` prop, so filtering stays ours.
    <Combobox
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={changeOpen}
      onValueChange={(locationId: null | string) => {
        if (locationId == null) {
          return;
        }
        const location = locations.find((item) => item.id === locationId);
        if (location?.activeShowing?.paywallId === paywallId) {
          changeOpen(false);
          return;
        }
        assignShowing({ locationId, paywallId, type: "paywall_release" });
      }}
      open={open}
      value={null}
    >
      <ComboboxTrigger render={trigger} showChevron={false} />
      <ComboboxContent>
        <ComboboxInput placeholder="Search locations..." showTrigger={false} />
        <ComboboxList>
          {matches.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground text-sm">No locations found.</p>
          ) : (
            matches.map((location) => {
              const isCurrent = location.activeShowing?.paywallId === paywallId;
              const showingName = location.activeShowing?.paywall?.name;

              return (
                <ComboboxItem key={location.id} value={location.id}>
                  <span className="flex min-w-0 flex-col">
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
                  </span>
                </ComboboxItem>
              );
            })
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
