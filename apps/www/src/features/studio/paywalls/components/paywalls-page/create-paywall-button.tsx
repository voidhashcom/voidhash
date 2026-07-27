"use client";

import { Button } from "@voidhash/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui/tooltip";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CreatePaywallModal } from "./create-paywall-modal";

interface CreatePaywallButtonProps {
  projectId: string;
}

export function CreatePaywallButton({ projectId }: CreatePaywallButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip>
      <CreatePaywallModal
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
        open={open}
        projectId={projectId}
        trigger={
          <TooltipTrigger
            render={
              <Button
                aria-label="Create new paywall"
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
      <TooltipContent>Create new paywall</TooltipContent>
    </Tooltip>
  );
}
