"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { ArchiveIcon, ArchiveRestoreIcon, MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import {
  archiveFeatureFlagOptions,
  queryKeys,
  restoreFeatureFlagOptions,
} from "@/features/studio/lib/tanstack-query";

interface FlagDetailActionsMenuProps {
  flagId: string;
  isArchived: boolean;
}

/** Kebab menu on the flag detail header — archive a live flag or restore it. */
export function FlagDetailActionsMenu({ flagId, isArchived }: FlagDetailActionsMenuProps) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.featureFlag.getFlag(flagId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.featureFlag.all });
  };

  const { isPending: isArchiving, mutate: archive } = useMutation({
    ...archiveFeatureFlagOptions(),
    onError: () => toast.error("Failed to archive flag"),
    onSuccess: async () => {
      toast.success("Flag archived");
      await invalidate();
    },
  });

  const { isPending: isRestoring, mutate: restore } = useMutation({
    ...restoreFeatureFlagOptions(),
    onError: () => toast.error("Failed to restore flag"),
    onSuccess: async () => {
      toast.success("Flag restored");
      await invalidate();
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Flag actions"
          disabled={isArchiving || isRestoring}
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {isArchived ? (
          <DropdownMenuItem onSelect={() => restore({ id: flagId })}>
            <ArchiveRestoreIcon />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => archive({ id: flagId })} variant="destructive">
            <ArchiveIcon />
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
