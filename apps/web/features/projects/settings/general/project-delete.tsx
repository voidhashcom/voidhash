"use client";

import { DeleteProjectModal } from "@/features/projects/delete-project-modal";
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
import { deleteProject } from "@/lib/actions/project/delete-project";
import { toast } from "sonner";

export function ProjectDelete({ projectId }: { projectId: string }) {
	const { organizationSlug, projectSlug } = useParams();
	const router = useRouter();

	const { execute, isPending } = useAction(deleteProject, {
		onSuccess: () => {
			toast.success("Project deleted successfully");
			router.push("/");
		},
		onError: (error) => {
			toast.error(error.error.serverError);
		},
	});

	const handleDelete = () => {
		execute({
			projectId,
		});
	};

	// Delete modal
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	if (typeof organizationSlug !== "string" || typeof projectSlug !== "string") {
		return null;
	}

	return (
		<Card className="pb-0 overflow-hidden mt-8" variant="destructive">
			<CardHeader>
				<CardTitle>Delete Project</CardTitle>
				<CardDescription>
					Permanently delete your project and all associated data. This action
					is irreversible.
				</CardDescription>
			</CardHeader>
			<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
				<div className="text-muted-foreground"></div>
				<div>
					<DeleteProjectModal
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
								{isPending ? "Deleting..." : "Delete Project"}
							</Button>
						}
						organizationSlug={organizationSlug}
						projectSlug={projectSlug}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}
