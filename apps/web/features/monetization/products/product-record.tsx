"use client";
import { deleteProductAction } from "@/lib/nextjs/server-actions";
import { getProducts } from "@/lib/services/products/queries";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	useConfirmDialog,
} from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { EllipsisVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { EditProductModal } from "./edit-product-modal";

export function ProductRecord({
	product,
	configurationStateIndicator,
	organizationSlug,
	projectSlug,
}: {
	product: NonNullable<Awaited<ReturnType<typeof getProducts>>>[number];
	configurationStateIndicator: React.ReactNode;
	organizationSlug: string;
	projectSlug: string;
}) {
	const router = useRouter();
	const [openEditModal, setOpenEditModal] = useState(false);

	const { execute: deleteProduct, isPending } = useAction(deleteProductAction, {
		onSuccess: () => {
			toast.success(`Product was successfully deleted`);
			router.refresh();
		},
		onError: (error) => {
			toast.error(
				error.error.serverError ??
					`Failed to delete the product. Please try again.`
			);
		},
	});

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeleteProduct = async () => {
		const res = await openDialog({
			title: "Delete product",
			description: `Are you sure you want to delete this product? This may break access for customers who have already purchased this.`,
		});

		if (!res) {
			return;
		}

		deleteProduct({
			productId: product.id,
		});
	};

	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<Link
				className="inset-0 absolute w-full h-full"
				href={`/${organizationSlug}/${projectSlug}/monetization/products/${product.id}`}
			></Link>
			<div className="flex flex-row items-center justify-between">
				<div className="flex gap-4 flex-1 items-center">
					<div>{product.name}</div>
					<div>{configurationStateIndicator}</div>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" className="z-20">
								<EllipsisVerticalIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-48" align="end">
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
								{isPending ? "Deleting..." : "Delete product"}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<ConfirmationDialog />
			<EditProductModal
				open={openEditModal}
				onClose={() => setOpenEditModal(false)}
				product={product}
			/>
		</div>
	);
}
