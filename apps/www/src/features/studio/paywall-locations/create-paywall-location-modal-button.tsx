"use client";

import { Button } from "@voidhash/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui/tooltip";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CreatePaywallLocationModal } from "./create-paywall-location-modal";

export function CreatePaywallLocationModalButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip>
      <CreatePaywallLocationModal
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
        open={open}
        projectId={projectId}
        trigger={
          <TooltipTrigger
            render={
              <Button
                aria-label="Add paywall location"
                onClick={() => setOpen(true)}
                size="icon"
                variant="ghost"
              >
                <Plus />
              </Button>
            }
          />
        }
      />
      <TooltipContent>Add paywall location</TooltipContent>
    </Tooltip>
  );
}
