"use client";

import {
	Badge,
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	useConfirmDialog,
} from "@voidhash/ui";
import { Clock4Icon, EllipsisVerticalIcon } from "lucide-react";
import { format } from "date-fns";

import { type getProviderProductsByProductId } from "@/lib/services/products/queries";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { deletePaymentProviderProductAction } from "@/lib/nextjs/server-actions";
import { useRouter } from "next/navigation";
import { ProviderProductSheet } from "./provider-product-sheet";
import { useState } from "react";

type ProviderProduct = Awaited<
	ReturnType<typeof getProviderProductsByProductId>
>[number];
export function ProductDetailProviderProductRecord({
	paymentProviderId,
	providerProduct,
}: {
	paymentProviderId: string;
	providerProduct: ProviderProduct;
}) {
	const router = useRouter();
	const paymentProvider = paymentProviders.find(
		(p) => p.id === paymentProviderId
	);

	const [openEditSheet, setOpenEditSheet] = useState(false);

	const { execute: deleteProviderProduct, isPending } = useAction(
		deletePaymentProviderProductAction,
		{
			onSuccess: () => {
				toast.success(
					`${paymentProvider?.title} product was successfully deleted`
				);
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to delete ${paymentProvider?.title} product. Please try again.`
				);
			},
		}
	);

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeleteProviderProduct = async () => {
		const res = await openDialog({
			title: "Delete product",
			description: `Are you sure you want to delete this ${paymentProvider?.title} product? This may break access for customers who have already purchased this.`,
		});

		if (!res) {
			return;
		}

		deleteProviderProduct({
			productId: providerProduct.productId,
			providerId: paymentProviderId,
			providerProductKey: providerProduct.providerProductKey,
		});
	};

	if (!paymentProvider) {
		return null;
	}

	return (
		<div
			key={providerProduct.providerProductKey}
			className="px-6 py-4 justify-between items-center flex hover:bg-accent/30"
		>
			<div className="flex flex-row gap-2">
				{paymentProvider.products.keyProperties.map((key) => (
					<Badge variant="outline" key={key}>
						{providerProduct.configuration?.[key]}
					</Badge>
				))}
			</div>
			<div className="flex flex-row gap-2">
				<div className="flex flex-row gap-4 text-muted-foreground">
					<div className="flex flex-row gap-1 items-center">
						<Clock4Icon className="w-4 h-4" />
						<span className="text-sm text-muted-foreground">
							{format(providerProduct.createdAt ?? new Date(), "MMM d, yyyy")}
						</span>
					</div>
					<div></div>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon" className="z-20">
							<EllipsisVerticalIcon className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-48" align="end">
						<DropdownMenuItem onSelect={() => setOpenEditSheet(true)}>
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={isPending}
							onSelect={handleDeleteProviderProduct}
						>
							{isPending ? "Deleting..." : "Delete"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<ConfirmationDialog />
			<ProviderProductSheet
				open={openEditSheet}
				onClose={() => setOpenEditSheet(false)}
				providerId={paymentProviderId}
				productId={providerProduct.productId}
				mode={"edit"}
				configuration={providerProduct.configuration}
			/>
		</div>
	);
}
