import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMe } from "@voidhash/features/auth/client/hooks/useMe";
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
import {
	deleteOrganizationMutation,
	updateOrganizationMutation,
} from "@voidhash/features/organizations/server/mutations";
import { useState } from "react";
import { DeleteOrganizationModal } from "@voidhash/features/organizations/client/components/delete-organization-modal";
import {
	isVoidhashError,
	parseVoidhashError,
} from "@voidhash/features/lib/errors";

const updateTeamNameSchema = z.object({
	name: z
		.string()
		.min(1, "Team name is required")
		.max(32, "Team name must be less than 32 characters"),
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/_organization/settings/general"
)({
	component: RouteComponent,
});

function TeamNameForm() {
	const context = Route.useRouteContext();
	const router = useRouter();
	const { organizationSlug } = Route.useParams();
	const { data: me } = useMe();

	const organization = me?.organizations.find(
		(org) => org.slug === organizationSlug
	);

	const form = useForm<UpdateTeamNameForm>({
		resolver: zodResolver(updateTeamNameSchema),
		defaultValues: {
			name: organization?.name,
		},
	});

	const { mutate: updateTeamName, isPending } = useMutation({
		mutationFn: updateOrganizationMutation,
		onSuccess: () => {
			context.queryClient.invalidateQueries();
			router.invalidate();
			toast.success("Team name updated successfully");
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to update team name. Please try again.");
		},
	});

	const onSubmit = (data: UpdateTeamNameForm) => {
		if (!organization) return;
		updateTeamName({
			data: {
				organizationId: organization.id,
				name: data.name,
			},
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardHeader>
						<CardTitle>Team name</CardTitle>
						<CardDescription>
							This is your team's visible name within Voidhash. For example, the
							name of your company or department.
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
											placeholder="Enter team name"
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

// function TeamUrlForm() {
// 	return (
// 		<Card className="pb-0 overflow-hidden mt-8">
// 			<CardHeader>
// 				<CardTitle>Team URL</CardTitle>
// 				<CardDescription>
// 					This is your team&apos;s URL namespace on voidhash. Within it, your
// 					team can inspect their projects, check out any recent activity, or
// 					configure settings to their liking.
// 				</CardDescription>
// 			</CardHeader>
// 			<CardContent>
// 				<Input className="max-w-64 text-foreground text-sm" />
// 			</CardContent>
// 			<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
// 				<div className="text-muted-foreground">
// 					Please use 48 characters at maximum.
// 				</div>
// 				<div>
// 					<Button>Save</Button>
// 				</div>
// 			</CardFooter>
// 		</Card>
// 	);
// }

function TeamDelete() {
	const { organizationSlug } = Route.useParams();
	const context = Route.useRouteContext();
	const router = useRouter();
	const { data: me } = useMe();

	const organization = me?.organizations.find(
		(org) => org.slug === organizationSlug
	);

	const { mutate: deleteOrganization, isPending: isDeleting } = useMutation({
		mutationFn: deleteOrganizationMutation,
		onSuccess: () => {
			toast.success("Team deleted successfully");
			context.queryClient.invalidateQueries();
			router.invalidate();
			router.navigate({ to: "/" });
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to delete team. Please try again.");
		},
	});

	const handleDelete = () => {
		if (!organization) return;
		deleteOrganization({
			data: {
				organizationId: organization.id,
			},
		});
	};

	// Delete modal
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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
								disabled={isDeleting}
							>
								{isDeleting ? "Deleting..." : "Delete Team"}
							</Button>
						}
						organizationSlug={organizationSlug}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}

function RouteComponent() {
	const { organizationSlug } = Route.useParams();

	return (
		<Page
			breadcrumbs={[
				{ title: "Settings", url: "/settings" },
				{ title: "Team", url: "/settings/team" },
				{ title: "Members", url: "/settings/team/members" },
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Team Settings</h1>
				<p className="text-muted-foreground mt-3">All settings for team</p>

				<TeamNameForm key={organizationSlug} />
				{/* <TeamUrlForm /> */}
				<TeamDelete />
			</div>
		</Page>
	);
}
