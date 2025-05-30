"use client";
import { deletePerkAction } from "@/lib/nextjs/server-actions";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	useConfirmDialog,
	TooltipProvider,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { CopyIcon, EllipsisVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Perk } from "@voidhash/db";
// import { EditProductModal } from "./edit-product-modal";

export function PerkRecord({
	perk,
}: {
	perk: Perk;
}) {
	const router = useRouter();
	// const [setOpenEditModal] = useState(false);

	const { execute: deletePerk, isPending } = useAction(deletePerkAction, {
		onExecute: () => {
			toast.loading("Deleting perk...");
		},
		onSuccess: () => {
			toast.dismiss();
			toast.success(`Perk was successfully deleted`);
			router.refresh();
		},
		onError: (error) => {
			toast.dismiss();
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
			{/* <Link
				className="inset-0 absolute w-full h-full pointer-events-"
				href={`/${organizationSlug}/${projectSlug}/monetization/perks/${perk.id}`}
			></Link> */}
			<div className="flex flex-row items-center justify-between z-10">
				<div className="flex gap-4 flex-1 items-center">
					<div className="flex gap-4 items-baseline">
						<div>{perk.name}</div>
						<code className="text-muted-foreground text-sm">{perk.slug}</code>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="z-20"
									onClick={(e) => {
										e.preventDefault();
										navigator.clipboard.writeText(perk.slug);
										toast.success("Slug (ID) copied to clipboard");
									}}
								>
									<CopyIcon className="w-4 h-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Click to copy Slug (ID)</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
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
