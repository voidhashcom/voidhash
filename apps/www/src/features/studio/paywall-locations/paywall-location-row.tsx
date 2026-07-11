"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paywall, RpcPaywallLocation } from "@voidhash/rpc";
import { Button } from "@voidhash/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  archivePaywallLocationOptions,
  assignPaywallLocationShowingOptions,
  clearPaywallLocationShowingOptions,
  listPaywallLocationShowingsOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

import { EditPaywallLocationModal } from "./edit-paywall-location-modal";

const formatDate = (value: Date | null | undefined) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
};

interface PaywallLocationRowProps {
  location: typeof RpcPaywallLocation.Type;
  paywalls: ReadonlyArray<typeof Paywall.Type>;
  projectId: string;
}

export function PaywallLocationRow({ location, paywalls, projectId }: PaywallLocationRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPaywallId, setSelectedPaywallId] = useState(
    location.activeShowing?.paywallId ?? "",
  );

  useEffect(() => {
    setSelectedPaywallId(location.activeShowing?.paywallId ?? "");
  }, [location.activeShowing?.paywallId]);

  const queryClient = useQueryClient();

  const { data: showings = [], isPending: isLoadingShowings } = useQuery({
    ...listPaywallLocationShowingsOptions({
      locationId: location.id,
    }),
    enabled: historyOpen,
  });

  const invalidateLocationQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.paywallLocation.list({ projectId }),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.paywallLocation.showings({ locationId: location.id }),
    });
  };

  const { mutate: assignShowing, status: assignStatus } = useMutation({
    ...assignPaywallLocationShowingOptions(),
    onError: () => {
      toast.error("Failed to assign paywall showing");
    },
    onSuccess: async () => {
      toast.success("Paywall showing assigned");
      await invalidateLocationQueries();
    },
  });

  const { mutate: clearShowing, status: clearStatus } = useMutation({
    ...clearPaywallLocationShowingOptions(),
    onError: () => {
      toast.error("Failed to clear paywall showing");
    },
    onSuccess: async () => {
      toast.success("Paywall showing cleared");
      await invalidateLocationQueries();
    },
  });

  const { mutate: archiveLocation, status: archiveStatus } = useMutation({
    ...archivePaywallLocationOptions(),
    onError: () => {
      toast.error("Failed to archive location");
    },
    onSuccess: async () => {
      toast.success("Location archived");
      await invalidateLocationQueries();
    },
  });

  const isMutating =
    assignStatus === "pending" || clearStatus === "pending" || archiveStatus === "pending";

  const activePaywallLabel =
    location.activeShowing?.paywall?.name ?? location.activeShowing?.paywallId;

  const activeReleaseLabel = location.activeShowing?.paywallRelease
    ? `v${location.activeShowing.paywallRelease.version}`
    : null;

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{location.name}</div>
            {location.archivedAt ? (
              <span className="rounded border px-2 py-0.5 text-xs">Archived</span>
            ) : null}
          </div>
          <div className="mt-0.5 font-mono text-muted-foreground text-sm">{location.slug}</div>
          {location.description ? (
            <p className="mt-1 text-muted-foreground text-sm">{location.description}</p>
          ) : null}
          <p className="mt-2 text-muted-foreground text-xs">
            Active: {activePaywallLabel ?? "none"}
            {activeReleaseLabel ? ` (${activeReleaseLabel})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <EditPaywallLocationModal
            initialDescription={location.description}
            initialName={location.name}
            locationId={location.id}
            onClose={() => setEditOpen(false)}
            open={editOpen}
            projectId={projectId}
            trigger={
              <Button
                disabled={location.archivedAt !== null}
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            }
          />
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen((current) => !current)}>
            {historyOpen ? "Hide History" : "Show History"}
          </Button>
          <Button
            disabled={isMutating || location.archivedAt !== null}
            size="sm"
            variant="outline"
            onClick={() => archiveLocation({ locationId: location.id })}
          >
            Archive
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
          disabled={location.archivedAt !== null || isMutating}
          value={selectedPaywallId}
          onChange={(event) => setSelectedPaywallId(event.target.value)}
        >
          <option value="">Select paywall</option>
          {paywalls.map((paywall) => (
            <option key={paywall.id} value={paywall.id}>
              {paywall.name} ({paywall.slug})
            </option>
          ))}
        </select>
        <Button
          disabled={location.archivedAt !== null || isMutating || selectedPaywallId.length === 0}
          size="sm"
          onClick={() =>
            assignShowing({
              locationId: location.id,
              paywallId: selectedPaywallId,
              type: "paywall_release",
            })
          }
        >
          Assign
        </Button>
        <Button
          disabled={location.archivedAt !== null || isMutating || location.activeShowing === null}
          size="sm"
          variant="outline"
          onClick={() => clearShowing({ locationId: location.id })}
        >
          Clear
        </Button>
      </div>

      {historyOpen ? (
        <div className="rounded-md border">
          {isLoadingShowings ? (
            <div className="px-3 py-2 text-muted-foreground text-sm">Loading history...</div>
          ) : showings.length === 0 ? (
            <div className="px-3 py-2 text-muted-foreground text-sm">No showing history yet.</div>
          ) : (
            <div className="divide-y">
              {showings.map((showing) => {
                const showingPaywallLabel =
                  showing.paywall?.name ?? showing.paywallId ?? "Unknown paywall";
                const showingReleaseLabel = showing.paywallRelease
                  ? `v${showing.paywallRelease.version}`
                  : "";

                return (
                  <div className="space-y-1 px-3 py-2 text-sm" key={showing.id}>
                    <div className="font-medium">
                      {showingPaywallLabel} {showingReleaseLabel}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Started: {formatDate(showing.startedAt)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Ended: {formatDate(showing.endedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
