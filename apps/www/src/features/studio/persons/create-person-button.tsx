"use client";

import { Button } from "@voidhash/ui";
import { useState } from "react";

import { CreatePersonModal } from "./create-person-modal";

export function CreatePersonButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <CreatePersonModal
      onClose={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Create Person</Button>}
    />
  );
}
