"use client";

import { Button } from "@voidhash/ui";
import { useState } from "react";

import { CreateCustomerModal } from "./create-customer-modal";

export function CreateCustomerButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <CreateCustomerModal
      onClose={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Create Customer</Button>}
    />
  );
}
