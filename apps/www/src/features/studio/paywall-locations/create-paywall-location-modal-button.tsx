"use client";

import { Button } from "@voidhash/ui/button";
import { useState } from "react";

import { CreatePaywallLocationModal } from "./create-paywall-location-modal";

export function CreatePaywallLocationModalButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePaywallLocationModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Add Location</Button>}
    />
  );
}
