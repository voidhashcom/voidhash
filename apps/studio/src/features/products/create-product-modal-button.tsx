"use client";
import { Button } from "@voidhash/ui/button";
import { useState } from "react";

import { CreateProductModal } from "./create-product-modal";

export function CreateProductModalButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <CreateProductModal
      onClose={() => setOpen(false)}
      onSuccess={() => setOpen(false)}
      open={open}
      projectId={projectId}
      trigger={<Button onClick={() => setOpen(true)}>Add Product</Button>}
    />
  );
}
