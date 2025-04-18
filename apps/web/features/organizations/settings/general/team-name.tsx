"use client";

import { updateOrganizationAction } from "@/lib/nextjs/server-actions";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	FormField,
	FormItem,
	FormControl,
	Input,
	FormMessage,
	CardFooter,
	Button,
	Form,
} from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/features/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

const updateTeamNameSchema = z.object({
	name: z
		.string()
		.min(1, "Team name is required")
		.max(32, "Team name must be less than 32 characters"),
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

export function TeamNameForm({
	organization,
}: { organization: Awaited<ReturnType<typeof getOrganizationBySlug>> }) {
	const form = useForm<UpdateTeamNameForm>({
		resolver: zodResolver(updateTeamNameSchema),
		defaultValues: {
			name: organization?.name,
		},
	});

	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const router = useRouter();

	const { execute: updateTeamName, isPending } = useAction(
		updateOrganizationAction,
		{
			onSuccess: () => {
				toast.success("Team name updated successfully");
				queryClient.invalidateQueries({
					queryKey: trpc.pathKey(),
				});
				router.refresh();
			},
			onError: (error) => {
				toast.error(error.error.serverError);
			},
		}
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
