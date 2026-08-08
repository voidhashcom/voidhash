"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RpcPaywallLocation } from "@voidhash/rpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import {
  ArchiveIcon,
  CircleSlashIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RepeatIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  archivePaywallLocationOptions,
  clearPaywallLocationShowingOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

import { EditPaywallLocationModal } from "./edit-paywall-location-modal";
import { PaywallCombobox } from "./paywall-combobox";

interface PaywallLocationActionsMenuProps {
  align?: "start" | "center" | "end";
  location: typeof RpcPaywallLocation.Type;
  triggerClassName?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}

/**
 * Kebab menu of actions for a single paywall location — change which paywall it
 * serves, end the current placement, edit its details, or archive it. Shared by
 * the locations index table and the location detail screen.
 */
export function PaywallLocationActionsMenu({
  align = "end",
  location,
  triggerClassName,
  triggerVariant = "ghost",
}: PaywallLocationActionsMenuProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  // The menu has closed by the time the combobox opens, so the popup anchors to
  // the kebab itself — it appears where the click landed.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isArchived = location.archivedAt != null;
  const projectId = location.projectId;

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.paywallLocation.list({ projectId }),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.paywallLocation.showings({ locationId: location.id }),
    });
  };

  const { mutate: clearShowing, status: clearStatus } = useMutation({
    ...clearPaywallLocationShowingOptions(),
    onError: () => toast.error("Failed to end placement"),
    onSuccess: async () => {
      toast.success("Placement ended");
      await invalidate();
    },
  });

  const { mutate: archiveLocation, status: archiveStatus } = useMutation({
    ...archivePaywallLocationOptions(),
    onError: () => toast.error("Failed to archive location"),
    onSuccess: async () => {
      toast.success("Location archived");
      await invalidate();
      setArchiveOpen(false);
    },
  });

  const isArchiving = archiveStatus === "pending";
  const isMutating = clearStatus === "pending" || isArchiving;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Paywall location actions"
            className={cn(triggerClassName)}
            disabled={isMutating}
            ref={triggerRef}
            size="icon-sm"
            variant={triggerVariant}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        {/* `DropdownMenuContent` sizes itself to the trigger, so an icon-sized
            trigger collapses it to the shared `min-w-32` floor. */}
        <DropdownMenuContent align={align} className="min-w-48">
          <DropdownMenuItem disabled={isArchived} onSelect={() => setPickerOpen(true)}>
            <RepeatIcon />
            Change paywall
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isArchived || location.activeShowing == null}
            onSelect={() => clearShowing({ locationId: location.id })}
          >
            <CircleSlashIcon />
            End placement
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isArchived} onSelect={() => setEditOpen(true)}>
            <PencilIcon />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isArchived}
            onSelect={() => setArchiveOpen(true)}
            variant="destructive"
          >
            <ArchiveIcon />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPaywallLocationModal
        initialDescription={location.description}
        initialName={location.name}
        locationId={location.id}
        onClose={() => setEditOpen(false)}
        open={editOpen}
        projectId={projectId}
      />

      <PaywallCombobox
        anchor={triggerRef}
        currentPaywallId={location.activeShowing?.paywallId}
        locationId={location.id}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
        projectId={projectId}
      />

      <AlertDialog onOpenChange={setArchiveOpen} open={archiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive paywall location</AlertDialogTitle>
            <AlertDialogDescription>
              Archive <span className="font-medium">{location.name}</span>? Apps still asking for{" "}
              <span className="font-mono text-xs">{location.slug}</span> will stop receiving a
              paywall. Its placement history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isArchiving}
              onClick={(event) => {
                event.preventDefault();
                archiveLocation({ locationId: location.id });
              }}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
