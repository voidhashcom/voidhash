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

import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { createCustomerAction } from "@/lib/nextjs/server-actions";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Extract the relevant parts from createCustomerInputSchema for the form
const createCustomerFormSchema = z.object({
	name: z.string().optional(),
	email: z.string().email(),
});

type CreateCustomerForm = z.infer<typeof createCustomerFormSchema>;

interface CreateCustomerModalProps {
	trigger: React.ReactNode;
	open: boolean;
	onClose: () => void;
	projectId: string;
}

export function CreateCustomerModal({
	open,
	onClose,
	trigger,
	projectId,
}: CreateCustomerModalProps) {
	const router = useRouter();
	const form = useForm<CreateCustomerForm>({
		resolver: zodResolver(createCustomerFormSchema),
		defaultValues: {
			name: "",
			email: "",
		},
	});

	const { execute, isPending } = useAction(createCustomerAction, {
		onSuccess: async () => {
			router.refresh();
			toast.success("Customer created successfully!");
			form.reset();
			onClose?.();
		},
		onError: (error) => {
			// Use the serverError field if available, otherwise fallback
			const errorMessage =
				error.error.serverError ||
				error.error.validationErrors?._errors?.join(", ") || // Combine top-level validation errors
				"Failed to create customer";
			toast.error(errorMessage);
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			form.reset(); // Reset form when closing
			onClose?.();
		}
	};

	const onSubmit = (data: CreateCustomerForm) => {
		execute({
			...data,
			projectId, // Add the projectId required by the action
		});
	};

	useEffect(() => {
		form.reset();
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create Customer</DialogTitle>
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
										<Input placeholder="John Doe" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="john.doe@example.com"
											{...field}
										/>
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
								{isPending ? "Creating Customer..." : "Create Customer"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
