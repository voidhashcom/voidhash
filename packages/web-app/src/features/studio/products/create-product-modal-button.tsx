"use client";
import { Button } from "@voidhash/ui/button";
import { IconButtonTooltip } from "@voidhash/ui/tooltip";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { CreateProductModal } from "./create-product-modal";

interface CreateProductModalButtonProps {
  projectId: string;
  iconOnly?: boolean;
}

export function CreateProductModalButton({
  projectId,
  iconOnly = false,
}: CreateProductModalButtonProps) {
  const [open, setOpen] = useState(false);

  if (iconOnly) {
    return (
      <>
        <IconButtonTooltip label="Add product">
          <Button
            aria-label="Add product"
            onClick={() => setOpen(true)}
            size="icon-sm"
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </Button>
        </IconButtonTooltip>
        <CreateProductModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          projectId={projectId}
        />
      </>
    );
  }

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
