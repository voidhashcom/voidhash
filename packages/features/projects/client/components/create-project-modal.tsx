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
import { useMutation } from "@tanstack/react-query";
import { createProjectMutation } from "../../server/mutations";
import { toast } from "sonner";
import { useRouter, useParams, useRouteContext } from "@tanstack/react-router";
import { isVoidhashError, parseVoidhashError } from "../../../lib/errors";
import { projectsQueryKeys } from "../query-utils";

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
	const context = useRouteContext({
		strict: false,
	});

	const form = useForm<CreateProjectForm>({
		resolver: zodResolver(createProjectSchema),
		defaultValues: {
			name: "",
		},
	});

	const { mutate: createProject, isPending } = useMutation({
		mutationFn: createProjectMutation,
		onSuccess: async (res) => {
			if (res?.id) {
				await router.invalidate();
				context?.queryClient?.invalidateQueries({
					queryKey: projectsQueryKeys.all,
				});
				onClose?.();

				// Navigate to the new project
				router.navigate({
					to: "/~/$organizationSlug/$projectSlug/dashboard",
					params: {
						organizationSlug,
						projectSlug: res.slug,
					},
				});
			}
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to create project. Please try again.");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
		}
	};

	const onSubmit = (data: CreateProjectForm) => {
		createProject({
			data: {
				...data,
				organizationId,
			},
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
