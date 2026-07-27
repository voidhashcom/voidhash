"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Perk, ProductPerk } from "@voidhash/rpc";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
  useConfirmDialog,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteProductPerkOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

export function ProductDetailPerkRecord({
  productPerk,
  perks,
}: {
  productPerk: typeof ProductPerk.Type;
  // biome-ignore lint/style/useConsistentArrayType: We need to use ReadonlyArray to avoid mutation
  perks: readonly (typeof Perk.Type)[];
}) {
  const perk = perks.find((p) => p.id === productPerk.perkId);

  const queryClient = useQueryClient();
  const { mutate: deleteProductPerk, status: deleteProductPerkStatus } = useMutation({
    ...deleteProductPerkOptions(),
    onSuccess: () => {
      toast.success(`${perk?.name} perk successfully deleted`);
      queryClient.invalidateQueries({
        queryKey: queryKeys.productPerk.listByProduct({
          productId: productPerk.productId,
        }),
      });
    },
    onError: () => {
      toast.error(`Failed to delete ${perk?.name} perk`);
    },
  });

  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const handleDeleteProductPerk = async () => {
    const res = await openDialog({
      description:
        "Are you sure you want to remove this perk from this product? This may break access for people who have already purchased this.",
      title: "Delete product perk",
    });

    if (!res) {
      return;
    }

    deleteProductPerk({
      id: productPerk.id,
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
      <div className={cn("flex flex-row gap-2")}>
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
              disabled={deleteProductPerkStatus === "pending"}
              onSelect={handleDeleteProductPerk}
            >
              {deleteProductPerkStatus === "pending" ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmationDialog />
    </div>
  );
}
