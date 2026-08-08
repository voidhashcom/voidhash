"use client";

import { Button } from "@voidhash/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui/tooltip";
import { Plus } from "lucide-react";

import { CreateFlagModal } from "./create-flag-modal";

/** Compact page-header action for creating a feature flag. */
export function CreateFlagButton({ projectId }: { projectId: string }) {
  return (
    <Tooltip>
      <CreateFlagModal
        projectId={projectId}
        trigger={
          <TooltipTrigger
            render={
              <Button aria-label="Create feature flag" size="icon" variant="ghost">
                <Plus />
              </Button>
            }
          />
        }
      />
      <TooltipContent>Create feature flag</TooltipContent>
    </Tooltip>
  );
}
