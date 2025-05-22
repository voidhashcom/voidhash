"use client";

import {
	Badge,
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	useConfirmDialog,
	cn,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { deleteProductPerkAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";
import type { Perk, ProductPerk } from "@voidhash/db";

export function ProductDetailPerkRecord({
	productPerk,
	perks,
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
			},
		}
	);

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeleteProductPerk = async () => {
		const res = await openDialog({
			title: "Delete product perk",
			description: `Are you sure you want to remove this perk from this product? This may break access for customers who have already purchased this.`,
		});

		if (!res) {
			return;
		}

		deleteProductPerk({
			productId: productPerk.productId,
			perkId: productPerk.perkId,
		});
	};

	if (!perk) {
		return null;
	}

	return (
		<div
			key={productPerk.perkId}
			className="px-6 py-4 justify-between items-center flex hover:bg-accent/30"
		>
			<div className={cn("flex flex-row gap-2")}>
				<Badge variant="outline" key={perk.id}>
					{perk.name}
				</Badge>
			</div>
			<div className="flex flex-row gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon" className="z-20">
							<EllipsisVerticalIcon className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-48" align="end">
						<DropdownMenuItem
							disabled={isPending}
							onSelect={handleDeleteProductPerk}
						>
							{isPending ? "Deleting..." : "Delete"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<ConfirmationDialog />
		</div>
	);
}
