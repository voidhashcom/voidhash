import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrganizationMutation } from "../../server/mutations";
import { toast } from "sonner";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { authQueryKeys } from "../../../auth/client/query-keys";
import { isVoidhashError, parseVoidhashError } from "../../../lib/errors";

const createOrganizationSchema = z.object({
	name: z
		.string()
		.min(1, "Organization name is required")
		.max(32, "Organization name must be less than 32 characters"),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;

interface CreateOrganizationModalProps {
	open: boolean;
	onClose: () => void;
	trigger: React.ReactNode;
}

export function CreateOrganizationModal({
	open,
	onClose,
	trigger,
}: CreateOrganizationModalProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const form = useForm<CreateOrganizationForm>({
		resolver: zodResolver(createOrganizationSchema),
		defaultValues: {
			name: "",
		},
	});

	const { mutate: createOrganization, isPending } = useMutation({
		mutationFn: createOrganizationMutation,
		onSuccess: async (res) => {
			if (res?.id) {
				// Invalidate auth queries to refresh user data
				await queryClient.invalidateQueries({
					queryKey: authQueryKeys.all,
				});

				await router.invalidate();

				onClose?.();

				// Navigate to the new organization
				router.navigate({
					to: "/~/$organizationSlug",
					params: { organizationSlug: res?.slug },
				});
			}
		},
		onError: (error) => {
			if (isVoidhashError(error)) {
				toast.error(parseVoidhashError(error));
			}
			toast.error("Failed to create team. Please try again.");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
		}
	};

	const onSubmit = (data: CreateOrganizationForm) => {
		createOrganization({
			data,
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create New Team</DialogTitle>
					<DialogDescription>
						Create a new team to collaborate with your colleagues.
					</DialogDescription>
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
									<FormLabel>Team Name</FormLabel>
									<FormControl>
										<Input placeholder="Acme Inc." {...field} />
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
								{isPending ? "Creating Team..." : "Create Team"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
