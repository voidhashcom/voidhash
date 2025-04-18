"use client";

import { DeleteOrganizationModal } from "@/features/organizations/delete-organization-modal";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
	Button,
} from "@voidhash/ui";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { deleteOrganizationAction } from "@/lib/nextjs/server-actions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/features/trpc/react";

export function TeamDelete({ organizationId }: { organizationId: string }) {
	const { organizationSlug } = useParams();
	const router = useRouter();
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const { execute, isPending } = useAction(deleteOrganizationAction, {
		onSuccess: () => {
			toast.success("Team deleted successfully");
			queryClient.invalidateQueries({
				queryKey: trpc.pathKey(),
			});
			router.push("/");
		},
		onError: (error) => {
			toast.error(error.error.serverError);
		},
	});

	const handleDelete = () => {
		execute({
			organizationId,
		});
	};

	// Delete modal
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	if (typeof organizationSlug !== "string") {
		return null;
	}

	return (
		<Card className="pb-0 overflow-hidden mt-8" variant="destructive">
			<CardHeader>
				<CardTitle>Delete Team</CardTitle>
				<CardDescription>
					Permanently delete your team and all associated data. This action is
					irreversible.
				</CardDescription>
			</CardHeader>
			<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
				<div className="text-muted-foreground"></div>
				<div>
					<DeleteOrganizationModal
						open={deleteModalOpen}
						onClose={() => setDeleteModalOpen(false)}
						onDelete={handleDelete}
						key={deleteModalOpen ? "open" : "closed"}
						trigger={
							<Button
								variant="destructive"
								onClick={() => setDeleteModalOpen(true)}
								disabled={isPending}
							>
								{isPending ? "Deleting..." : "Delete Team"}
							</Button>
						}
						organizationSlug={organizationSlug}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}
