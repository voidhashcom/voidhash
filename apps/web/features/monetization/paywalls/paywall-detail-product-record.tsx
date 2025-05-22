"use client";

import {
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	cn,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";

import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { deletePaywallProductAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";
import { type GetPaywallProducts } from "@/lib/services/paywalls/queries";

export function PaywallDetailProductRecord({
	paywallProduct,
}: {
	paywallProduct: GetPaywallProducts[number];
}) {
	const router = useRouter();

	const { execute: removePaywallProduct, isPending } = useAction(
		deletePaywallProductAction,
		{
			onSuccess: () => {
				toast.success(`Product was successfully removed`);
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to remove product. Please try again.`
				);
			},
		}
	);

	const handleRemovePaywallProduct = async () => {
		removePaywallProduct({
			paywallId: paywallProduct.paywallId,
			productId: paywallProduct.productId,
		});
	};

	if (!paywallProduct) {
		return null;
	}

	return (
		<div
			key={paywallProduct.productId}
			className="px-6 py-4 justify-between items-center flex hover:bg-accent/30"
		>
			<div className={cn("flex flex-row gap-2")}>
				{paywallProduct.product.name}
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
							onSelect={handleRemovePaywallProduct}
						>
							{isPending ? "Removing..." : "Remove"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
