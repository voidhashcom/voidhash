"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@voidhash/features/auth/hooks/useMe";
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
import { DeleteOrganizationModal } from "@voidhash/features/organizations/components/delete-organization-modal";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@voidhash/features/trpc/react";

const updateTeamNameSchema = z.object({
	name: z
		.string()
		.min(1, "Team name is required")
		.max(32, "Team name must be less than 32 characters"),
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

function TeamNameForm() {
	const { organizationSlug } = useParams();
	const { data: me } = useMe();

	const queryClient = useQueryClient();
	const organization = me?.organizations.find(
		(org) => org.slug === organizationSlug
	);

	const form = useForm<UpdateTeamNameForm>({
		resolver: zodResolver(updateTeamNameSchema),
		defaultValues: {
			name: organization?.name,
		},
	});

	const trpc = useTRPC();
	const { mutate: updateTeamName, isPending } = useMutation(
		trpc.organizations.update.mutationOptions({
			onSuccess: () => {
				toast.success("Team name updated successfully");
			},
			onError: (error) => {
				if (error.data?.voidhashError) {
					toast.error(error.data.voidhashError.message);
				}
				toast.error("Failed to update team name. Please try again.");
			},
			onSettled: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.pathKey(),
				});
			},
		})
	);

	const onSubmit = (data: UpdateTeamNameForm) => {
		if (!organization) return;
		updateTeamName({
			organizationId: organization.id,
			name: data.name,
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardHeader>
						<CardTitle>Team name</CardTitle>
						<CardDescription>
							This is your team&apos;s visible name within Voidhash. For
							example, the name of your company or department.
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
	const { organizationSlug } = useParams();
	const router = useRouter();
	const { data: me } = useMe();

	const organization = me?.organizations.find(
		(org) => org.slug === organizationSlug
	);

	const trpc = useTRPC();
	const { mutate: deleteOrganization, isPending: isDeleting } = useMutation(
		trpc.organizations.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Team deleted successfully");
				router.push("/");
			},
			onError: (error) => {
				if (error.data?.voidhashError) {
					toast.error(error.data.voidhashError.message);
				}
				toast.error("Failed to delete team. Please try again.");
			},
		})
	);

	const handleDelete = () => {
		if (!organization) return;
		deleteOrganization({
			organizationId: organization.id,
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

export default function GeneralSettingsPage() {
	const { organizationSlug } = useParams();

	if (typeof organizationSlug !== "string") {
		return null;
	}

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
