"use client";

import { Button } from "@voidhash/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui/tooltip";
import { Plus } from "lucide-react";

import { CreateExperimentModal } from "./create-experiment-modal";

/** Compact page-header action for creating an A/B test. */
export function CreateExperimentButton({ projectId }: { projectId: string }) {
  return (
    <Tooltip>
      <CreateExperimentModal
        projectId={projectId}
        trigger={
          <TooltipTrigger
            render={
              <Button aria-label="Create A/B test" size="icon" variant="ghost">
                <Plus />
              </Button>
            }
          />
        }
      />
      <TooltipContent>Create A/B test</TooltipContent>
    </Tooltip>
  );
}
