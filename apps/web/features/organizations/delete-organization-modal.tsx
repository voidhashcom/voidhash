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

interface DeleteOrganizationModalProps {
	open: boolean;
	onClose: () => void;
	onDelete: () => void;
	trigger: React.ReactNode;
	organizationSlug: string;
}

type DeleteOrganizationForm = {
	confirmation: string;
};

export function DeleteOrganizationModal({
	open,
	onClose,
	onDelete,
	trigger,
	organizationSlug,
}: DeleteOrganizationModalProps) {
	const deleteOrganizationSchema = z.object({
		confirmation: z
			.string()
			.refine((value) => value === `${organizationSlug}`, {
				message:
					"Please enter the text exactly as it is shown to confirm deletion",
			}),
	});

	const form = useForm<DeleteOrganizationForm>({
		resolver: zodResolver(deleteOrganizationSchema),
		defaultValues: {
			confirmation: "",
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
		}
	};

	const onSubmit = () => {
		onClose();
		onDelete();
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Delete Team</DialogTitle>
					<DialogDescription>
						This action cannot be undone. This will permanently delete the
						organization and all associated data.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4  mt-2"
					>
						<FormField
							control={form.control}
							name="confirmation"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										Please type{" "}
										<span className="font-mono select-text">
											{organizationSlug}
										</span>{" "}
										to confirm
									</FormLabel>
									<FormControl>
										<Input placeholder={`${organizationSlug}`} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className="justify-between">
							<Button variant="outline" onClick={onClose} className="mt-3">
								Cancel
							</Button>
							<Button type="submit" variant="destructive" className="mt-3">
								Delete Team
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
