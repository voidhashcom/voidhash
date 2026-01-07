"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Product } from "@voidhash/rpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useConfirmDialog,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteProductOptions, queryKeys } from "src/lib/tanstack-query";

import { EditProductModal } from "./edit-product-modal";

export function ProductRecord({
  product,
  configurationStateIndicator,
  organizationSlug,
  projectSlug,
}: {
  product: typeof Product.Type;
  configurationStateIndicator: React.ReactNode;
  organizationSlug: string;
  projectSlug: string;
}) {
  const [openEditModal, setOpenEditModal] = useState(false);

  const queryClient = useQueryClient();
  const { mutate: deleteProduct, status: deleteProductStatus } = useMutation({
    ...deleteProductOptions(),
    onSuccess: () => {
      toast.success("Product successfully deleted");
      queryClient.invalidateQueries({
        queryKey: queryKeys.product.list({ projectId: product.projectId }),
      });
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
  });

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeleteProduct = async () => {
    const res = await openDialog({
      description:
        "Are you sure you want to delete this product? This may break access for customers who have already purchased this.",
      title: "Delete product",
    });

    if (!res) {
      return;
    }

    deleteProduct({
      id: product.id,
    });
  };

  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        params={{ id: product.id, organizationSlug, projectSlug }}
        to="/$organizationSlug/$projectSlug/products/$id"
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div>{product.name}</div>
          <div>{configurationStateIndicator}</div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="z-20" size="icon" variant="outline">
                <EllipsisVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  setOpenEditModal(true);
                }}
              >
                Edit product
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={deleteProductStatus === "pending"}
                onClick={handleDeleteProduct}
              >
                {deleteProductStatus === "pending"
                  ? "Deleting..."
                  : "Delete product"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ConfirmationDialog />
      <EditProductModal
        onClose={() => setOpenEditModal(false)}
        open={openEditModal}
        product={product}
      />
    </div>
  );
}
