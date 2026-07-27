"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PageHeader,
  PageHeaderTitle,
  ScrollArea,
  Skeleton,
  useConfirmDialog,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import {
  deleteProductOptions,
  getProductOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

import { EditProductModal } from "./edit-product-modal";
import { ProductDetailBody } from "./product-detail-body";

interface ProductDetailPaneProps {
  productId: string;
  projectId: string;
  organizationSlug: string;
  projectSlug: string;
  onDeleted: () => void;
}

export function ProductDetailPane(props: ProductDetailPaneProps) {
  return (
    <Suspense fallback={<ProductDetailPaneSkeleton />}>
      <ProductDetailPaneContent key={props.productId} {...props} />
    </Suspense>
  );
}

function ProductDetailPaneContent({
  productId,
  projectId,
  organizationSlug,
  projectSlug,
  onDeleted,
}: ProductDetailPaneProps) {
  const queryClient = useQueryClient();
  const [openEditModal, setOpenEditModal] = useState(false);
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const { data: product } = useSuspenseQuery(getProductOptions({ productId }));

  const { mutate: deleteProduct, status: deleteProductStatus } = useMutation({
    ...deleteProductOptions(),
    onSuccess: () => {
      toast.success("Product successfully deleted");
      queryClient.invalidateQueries({
        queryKey: queryKeys.product.list({ projectId }),
      });
      onDeleted();
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
  });

  const handleDeleteProduct = async () => {
    const res = await openDialog({
      description:
        "Are you sure you want to delete this product? This may break access for people who have already purchased this.",
      title: "Delete product",
    });

    if (!res) {
      return;
    }

    deleteProduct({ id: product.id });
  };

  return (
    <>
      <PageHeader
        rightActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Product actions" size="icon-sm" variant="ghost">
                <EllipsisVerticalIcon className="size-4" />
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
                {deleteProductStatus === "pending" ? "Deleting..." : "Delete product"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <PageHeaderTitle>{product.name}</PageHeaderTitle>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <ProductDetailBody
            organizationSlug={organizationSlug}
            productId={product.id}
            projectId={projectId}
            projectSlug={projectSlug}
          />
        </div>
      </ScrollArea>

      <ConfirmationDialog />
      <EditProductModal
        onClose={() => setOpenEditModal(false)}
        open={openEditModal}
        product={product}
      />
    </>
  );
}

function ProductDetailPaneSkeleton() {
  return (
    <>
      <PageHeader>
        <Skeleton className="h-4 w-40" />
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </>
  );
}
