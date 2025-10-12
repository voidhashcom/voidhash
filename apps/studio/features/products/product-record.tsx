'use client';
import type { Product } from '@voidhash/db';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useConfirmDialog
} from '@voidhash/ui';
import { EllipsisVerticalIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { deleteProductAction } from '@/lib/nextjs/server-actions';
import { EditProductModal } from './edit-product-modal';

export function ProductRecord({
  product,
  configurationStateIndicator,
  organizationSlug,
  projectSlug
}: {
  product: Product;
  configurationStateIndicator: React.ReactNode;
  organizationSlug: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [openEditModal, setOpenEditModal] = useState(false);

  const { execute: deleteProduct, isPending } = useAction(deleteProductAction, {
    onSuccess: () => {
      toast.success('Product was successfully deleted');
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        error.error.serverError ??
          'Failed to delete the product. Please try again.'
      );
    }
  });

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeleteProduct = async () => {
    const res = await openDialog({
      title: 'Delete product',
      description:
        'Are you sure you want to delete this product? This may break access for customers who have already purchased this.'
    });

    if (!res) {
      return;
    }

    deleteProduct({
      productId: product.id
    });
  };

  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        href={`/${organizationSlug}/${projectSlug}/products/${product.id}`}
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
                disabled={isPending}
                onClick={handleDeleteProduct}
              >
                {isPending ? 'Deleting...' : 'Delete product'}
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
