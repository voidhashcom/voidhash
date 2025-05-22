"use client";

import { updateProjectAction } from "@/lib/nextjs/server-actions";
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
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/features/trpc/react";
import type { Project } from "@voidhash/db";

const updateProjectNameSchema = z.object({
	name: z
		.string()
		.min(1, "Project name is required")
		.max(32, "Project name must be less than 32 characters"),
});

type UpdateProjectNameForm = z.infer<typeof updateProjectNameSchema>;

export function ProjectNameForm({ project }: { project: Project }) {
	const form = useForm<UpdateProjectNameForm>({
		resolver: zodResolver(updateProjectNameSchema),
		defaultValues: {
			name: project?.name,
		},
	});

	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const router = useRouter();

	const { execute: updateProjectName, isPending } = useAction(
		updateProjectAction,
		{
			onSuccess: () => {
				toast.success("Project name updated successfully");
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

	const onSubmit = (data: UpdateProjectNameForm) => {
		if (!project) return;
		updateProjectName({
			id: project.id,
			name: data.name,
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardHeader>
						<CardTitle>Project Name</CardTitle>
						<CardDescription>
							This is your project&apos;s visible name within Voidhash.
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
