"use client";
import { deletePaywallLocationAction } from "@/lib/nextjs/server-actions";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	useConfirmDialog,
	Badge,
	TooltipTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
} from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { CopyIcon, EllipsisVerticalIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getPaywallLocations } from "@/lib/services/paywall-locations/queries";
import { type getPaywalls } from "@/lib/services/paywalls/queries";
// import { EditProductModal } from "./edit-product-modal";

export function PaywallLocationRecord({
	paywallLocation,
	organizationSlug,
	projectSlug,
	paywalls,
}: {
	paywallLocation: NonNullable<
		Awaited<ReturnType<typeof getPaywallLocations>>
	>[number];
	organizationSlug: string;
	projectSlug: string;
	paywalls: Awaited<ReturnType<typeof getPaywalls>>;
}) {
	const router = useRouter();
	// const [setOpenEditModal] = useState(false);

	const { execute: deletePaywallLocation, isPending } = useAction(
		deletePaywallLocationAction,
		{
			onSuccess: () => {
				toast.success(`Paywall location was successfully deleted`);
				router.refresh();
			},
			onError: (error) => {
				toast.error(
					error.error.serverError ??
						`Failed to delete the paywall location. Please try again.`
				);
			},
		}
	);

	const { ConfirmationDialog, openDialog } = useConfirmDialog();

	const handleDeletePaywallLocation = async () => {
		const res = await openDialog({
			title: "Delete paywall location",
			description: `Are you sure you want to delete this paywall location?`,
		});

		if (!res) {
			return;
		}

		deletePaywallLocation({
			paywallLocationId: paywallLocation.id,
		});
	};

	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			{/* <Link
				className="inset-0 absolute w-full h-full pointer-events-"
				href={`/${organizationSlug}/${projectSlug}/monetization/paywall-locations/${paywallLocation.id}`}
			></Link> */}
			<div className="flex flex-row items-center justify-between z-10">
				<div className="flex gap-4 flex-1 items-center">
					<div className="flex gap-1 items-baseline flex-col">
						<div className="flex gap-2 items-center">
							<div>{paywallLocation.name}</div>
							<Badge variant="outline">
								{paywalls.find(
									(paywall) => paywall.id === paywallLocation.defaultPaywallId
								)?.name ?? "No paywall"}
							</Badge>
						</div>
						<code className="text-muted-foreground text-sm">
							{paywallLocation.slug}
						</code>
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
										navigator.clipboard.writeText(paywallLocation.slug);
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
								onClick={handleDeletePaywallLocation}
							>
								{isPending ? "Deleting..." : "Delete location"}
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
