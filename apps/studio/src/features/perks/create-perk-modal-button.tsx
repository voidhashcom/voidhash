"use client";
import { Button } from "@voidhash/ui/button";
import { useState } from "react";

import { CreatePerkModal } from "./create-perk-modal";

export function CreatePerkModalButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <CreatePerkModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Add Perk</Button>}
    />
  );
}
