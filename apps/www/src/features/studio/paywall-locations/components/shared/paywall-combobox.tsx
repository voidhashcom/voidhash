"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@voidhash/ui";
import { type ReactElement, type RefObject, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  assignPaywallLocationShowingOptions,
  listPaywallsOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

export interface PaywallComboboxProps {
  /**
   * Anchors the popup when there is no inline trigger to hang it off — used by
   * the actions menu, which has closed by the time the combobox opens.
   */
  anchor?: RefObject<HTMLElement | null>;
  currentPaywallId?: null | string;
  locationId: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  projectId: string;
  /** Inline element that opens the popup; omit when driving `open` externally. */
  trigger?: ReactElement;
}

/**
 * Combobox listing the project's paywalls. Picking one starts a new placement
 * at this location, ending whichever placement was active — a location serves
 * exactly one paywall at a time.
 */
export function PaywallCombobox({
  anchor,
  currentPaywallId,
  locationId,
  onOpenChange,
  open,
  projectId,
  trigger,
}: PaywallComboboxProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isOpen = open ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setQuery("");
    }
  };

  const { data: paywalls = [] } = useQuery({
    ...listPaywallsOptions({ projectId }),
    enabled: isOpen,
  });

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return paywalls;
    }
    return paywalls.filter((paywall) =>
      `${paywall.name} ${paywall.slug}`.toLowerCase().includes(needle),
    );
  }, [paywalls, query]);

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
              OrElse: () => "Failed to change paywall",
            })
          : "Failed to change paywall",
      );
    },
    onSuccess: async () => {
      toast.success("Paywall changed");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.list({ projectId }),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.showings({ locationId }),
      });
      setOpen(false);
    },
  });

  return (
    // The search text is driven through the root's `inputValue` rather than the
    // input element — Base UI owns that input's value, so controlling the
    // element directly fights it. No `items` prop, so filtering stays ours.
    <Combobox
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={setOpen}
      onValueChange={(paywallId: null | string) => {
        if (paywallId == null || paywallId === currentPaywallId) {
          setOpen(false);
          return;
        }
        assignShowing({ locationId, paywallId, type: "paywall_release" });
      }}
      open={isOpen}
      value={currentPaywallId ?? null}
    >
      {trigger && <ComboboxTrigger render={trigger} showChevron={false} />}
      <ComboboxContent anchor={anchor}>
        <ComboboxInput placeholder="Search paywalls..." showTrigger={false} />
        <ComboboxList>
          {matches.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground text-sm">No paywalls found.</p>
          ) : (
            matches.map((paywall) => (
              <ComboboxItem key={paywall.id} value={paywall.id}>
                <span className="truncate">{paywall.name}</span>
                <span className="ml-auto truncate font-mono text-muted-foreground text-xs">
                  {paywall.slug}
                </span>
              </ComboboxItem>
            ))
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
