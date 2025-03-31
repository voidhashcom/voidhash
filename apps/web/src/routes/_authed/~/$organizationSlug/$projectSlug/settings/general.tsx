import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Input,
	Page,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@voidhash/ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import {
	isVoidhashError,
	parseVoidhashError,
} from "@voidhash/features/lib/errors";
import { useActiveProject } from "@voidhash/features/shell/hooks/useActiveProject";
import { DeleteProjectModal } from "@voidhash/features/projects/client/components/delete-project-modal";
import { useActiveOrganization } from "@voidhash/features/shell/hooks/useActiveOrganization";
import {
	deleteProjectMutation,
	updateProjectMutation,
} from "@voidhash/features/projects/server/mutations";
import { projectsQueryKeys } from "@voidhash/features/projects/client/query-utils";

const updateProjectNameSchema = z.object({
	name: z
		.string()
		.min(1, "Project name is required")
		.max(32, "Project name must be less than 32 characters"),
});

type UpdateProjectNameForm = z.infer<typeof updateProjectNameSchema>;

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/$projectSlug/settings/general"
)({
	component: RouteComponent,
});

function ProjectNameForm() {
	const context = Route.useRouteContext();
	const router = useRouter();
	const project = useActiveProject();

	const form = useForm<UpdateProjectNameForm>({
		resolver: zodResolver(updateProjectNameSchema),
		defaultValues: {
			name: project?.name,
		},
	});

	const { mutate: updateProjectName, isPending } = useMutation({
		mutationFn: updateProjectMutation,
		onSuccess: () => {
			context.queryClient.invalidateQueries({
				queryKey: projectsQueryKeys.all,
			});
			router.invalidate();
			toast.success("Project name updated successfully");
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to update project name. Please try again.");
		},
	});

	const onSubmit = (data: UpdateProjectNameForm) => {
		if (!project) return;
		updateProjectName({
			data: {
				projectId: project.id,
				name: data.name,
			},
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardHeader>
						<CardTitle>Project Name</CardTitle>
						<CardDescription>
							This is your project's visible name within Voidhash.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											className="max-w-64 text-foreground text-sm"
											placeholder="Enter project name"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
					<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
						<div className="text-muted-foreground">
							Please use 32 characters at maximum.
						</div>
						<div>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Saving..." : "Save"}
							</Button>
						</div>
					</CardFooter>
				</Card>
			</form>
		</Form>
	);
}

function ProjectDelete() {
	const context = Route.useRouteContext();
	const router = useRouter();
	const activeOrganization = useActiveOrganization();
	const activeProject = useActiveProject();

	const { mutate: deleteProject, isPending: isDeleting } = useMutation({
		mutationFn: deleteProjectMutation,
		onSuccess: () => {
			toast.success("Project deleted successfully");
			context.queryClient.invalidateQueries({
				queryKey: projectsQueryKeys.all,
			});
			router.invalidate();
			router.navigate({ to: "/" });
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to delete project. Please try again.");
		},
	});

	const handleDelete = () => {
		if (!activeProject) return;
		deleteProject({
			data: {
				projectId: activeProject.id,
			},
		});
	};

	// Delete modal
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	if (!activeOrganization || !activeProject) return null;

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
								disabled={isDeleting}
							>
								{isDeleting ? "Deleting..." : "Delete Project"}
							</Button>
						}
						organizationSlug={activeOrganization?.slug}
						projectSlug={activeProject?.slug}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}

function RouteComponent() {
	const { organizationSlug } = Route.useParams();

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">
					Project Settings
				</h1>
				<p className="text-muted-foreground mt-3">All settings for project</p>

				<ProjectNameForm key={organizationSlug} />
				<ProjectDelete />
			</div>
		</Page>
	);
}
