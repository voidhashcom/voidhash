'use client';

import type { Perk, ProductPerk } from '@voidhash/db';
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useConfirmDialog
} from '@voidhash/ui';
import { EllipsisVerticalIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { deleteProductPerkAction } from '@/lib/nextjs/server-actions';

export function ProductDetailPerkRecord({
  productPerk,
  perks
}: {
  productPerk: ProductPerk;
  perks: Perk[];
}) {
  const router = useRouter();
  const perk = perks.find((p) => p.id === productPerk.perkId);

  const { execute: deleteProductPerk, isPending } = useAction(
    deleteProductPerkAction,
    {
      onSuccess: () => {
        toast.success(`${perk?.name} perk was successfully deleted`);
        router.refresh();
      },
      onError: (error) => {
        toast.error(
          error.error.serverError ??
            `Failed to delete ${perk?.name} perk. Please try again.`
        );
      }
    }
  );

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeleteProductPerk = async () => {
    const res = await openDialog({
      title: 'Delete product perk',
      description:
        'Are you sure you want to remove this perk from this product? This may break access for customers who have already purchased this.'
    });

    if (!res) {
      return;
    }

    deleteProductPerk({
      productId: productPerk.productId,
      perkId: productPerk.perkId
    });
  };

  if (!perk) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between px-6 py-4 hover:bg-accent/30"
      key={productPerk.perkId}
    >
      <div className={cn('flex flex-row gap-2')}>
        <Badge key={perk.id} variant="outline">
          {perk.name}
        </Badge>
      </div>
      <div className="flex flex-row gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="z-20" size="icon" variant="outline">
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              disabled={isPending}
              onSelect={handleDeleteProductPerk}
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmationDialog />
    </div>
  );
}
