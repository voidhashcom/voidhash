"use client";
import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@voidhash/ui/dialog";
import { Input } from "@voidhash/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@voidhash/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { createProjectAction } from "@/lib/nextjs/server-actions";
import { useTRPC } from "../trpc/react";
const createProjectSchema = z.object({
	name: z
		.string()
		.min(1, "Project name is required")
		.max(32, "Project name must be less than 32 characters"),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
	open: boolean;
	onClose: () => void;
	trigger: React.ReactNode;
	organizationId: string;
	organizationSlug: string;
}

export function CreateProjectModal({
	open,
	onClose,
	trigger,
	organizationId,
	organizationSlug,
}: CreateProjectModalProps) {
	const router = useRouter();

	const form = useForm<CreateProjectForm>({
		resolver: zodResolver(createProjectSchema),
		defaultValues: {
			name: "",
		},
	});

	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const { execute, isPending } = useAction(createProjectAction, {
		onSuccess: async (res) => {
			queryClient.invalidateQueries();
			router.push(`/${organizationSlug}/${res.data?.slug}`);
			queryClient.invalidateQueries({
				queryKey: trpc.projects.pathKey(),
			});
			onClose?.();
		},
		onError: (error) => {
			toast.error(error.error.serverError);
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
		}
	};

	const onSubmit = (data: CreateProjectForm) => {
		execute({
			...data,
			organizationId,
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create New Project</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="My Awesome App" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<Button
								type="submit"
								disabled={isPending}
								className="w-full mt-4"
							>
								{isPending ? "Creating Project..." : "Create Project"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
