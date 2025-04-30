"use client";
import { deletePaywallAction } from "@/lib/nextjs/server-actions";
import { getPaywalls } from "@/lib/services/paywalls/queries";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
// import { EditProductModal } from "./edit-product-modal";

export function PaywallRecord({
	paywall,
	organizationSlug,
	projectSlug,
}: {
	paywall: NonNullable<Awaited<ReturnType<typeof getPaywalls>>>[number];
	organizationSlug: string;
	projectSlug: string;
}) {
	const router = useRouter();
	// const [setOpenEditModal] = useState(false);

	const { execute: deletePaywall, isPending } = useAction(deletePaywallAction, {
		onSuccess: () => {
			toast.success(`Paywall was successfully deleted`);
			router.refresh();
		},
		onError: (error) => {
			toast.error(
				error.error.serverError ??
					`Failed to delete the paywall. Please try again.`
			);
		},
	});

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeletePaywall = async () => {
		const res = await openDialog({
			title: "Delete paywall",
			description: `Are you sure you want to delete this paywall?`,
		});

		if (!res) {
			return;
		}

		deletePaywall({
			paywallId: paywall.id,
		});
	};

	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<Link
				className="inset-0 absolute w-full h-full"
				href={`/${organizationSlug}/${projectSlug}/storefront/paywalls/${paywall.id}`}
			></Link>
			<div className="flex flex-row items-center justify-between">
				<div className="flex gap-4 flex-1 items-center">
					<div>{paywall.name}</div>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" className="z-20">
								<EllipsisVerticalIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-48" align="end">
							{/* <DropdownMenuItem
								className="cursor-pointer"
								onSelect={(e) => {
									e.preventDefault();
									setOpenEditModal(true);
								}}
							>
								Edit paywall
							</DropdownMenuItem> */}
							<DropdownMenuItem
								className="cursor-pointer"
								disabled={isPending}
								onClick={handleDeletePaywall}
							>
								{isPending ? "Deleting..." : "Delete paywall"}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<ConfirmationDialog />
			{/* <EditProductModal
				open={openEditModal}
				onClose={() => setOpenEditModal(false)}
				product={product}
			/> */}
		</div>
	);
}
