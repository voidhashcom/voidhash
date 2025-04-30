"use client";
import { deletePerkAction } from "@/lib/nextjs/server-actions";
import { getPerks } from "@/lib/services/perks/queries";
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

export function PerkRecord({
	perk,
	organizationSlug,
	projectSlug,
}: {
	perk: NonNullable<Awaited<ReturnType<typeof getPerks>>>[number];
	organizationSlug: string;
	projectSlug: string;
}) {
	const router = useRouter();
	// const [setOpenEditModal] = useState(false);

	const { execute: deletePerk, isPending } = useAction(deletePerkAction, {
		onSuccess: () => {
			toast.success(`Perk was successfully deleted`);
			router.refresh();
		},
		onError: (error) => {
			toast.error(
				error.error.serverError ??
					`Failed to delete the perk. Please try again.`
			);
		},
	});

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeletePerk = async () => {
		const res = await openDialog({
			title: "Delete perk",
			description: `Are you sure you want to delete this perk?`,
		});

		if (!res) {
			return;
		}

		deletePerk({
			perkId: perk.id,
		});
	};

	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<Link
				className="inset-0 absolute w-full h-full"
				href={`/${organizationSlug}/${projectSlug}/monetization/perks/${perk.id}`}
			></Link>
			<div className="flex flex-row items-center justify-between">
				<div className="flex gap-4 flex-1 items-center">
					<div>{perk.name}</div>
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
								Edit perk
							</DropdownMenuItem> */}
							<DropdownMenuItem
								className="cursor-pointer"
								disabled={isPending}
								onClick={handleDeletePerk}
							>
								{isPending ? "Deleting..." : "Delete perk"}
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
