"use client";

import { Button } from "@voidhash/ui/button";
import { useState } from "react";

import { CreatePaywallModal } from "./create-paywall-modal";

interface CreatePaywallButtonProps {
  projectId: string;
}

export function CreatePaywallButton({ projectId }: CreatePaywallButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePaywallModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Create Paywall</Button>}
    />
  );
}
