"use client";

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
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { createProductAction } from "@/lib/nextjs/server-actions";

const createProductSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),
});

type CreateProductForm = z.infer<typeof createProductSchema>;

// Define a Product type matching the DB schema
export type Product = {
	id: string;
	name: string;
	projectId: string;
	createdAt?: string;
	updatedAt?: string;
};

interface CreateProductModalProps {
	open: boolean;
	onClose: () => void;
	trigger: React.ReactNode;
	projectId: string;
	onSuccess?: (product: Product) => void;
}

export function CreateProductModal({
	open,
	onClose,
	trigger,
	projectId,
	onSuccess,
}: CreateProductModalProps) {
	const form = useForm<CreateProductForm>({
		resolver: zodResolver(createProductSchema),
		defaultValues: {
			name: "",
		},
	});

	const { execute, isPending } = useAction(createProductAction, {
		onSuccess: (res) => {
			if (res.data) {
				toast.success("Product created successfully");
				onSuccess?.(res.data);
				handleOpenChange(false);
			}
		},
		onError: (error) => {
			toast.error(error.error.serverError || "Failed to create product");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
			form.reset();
		}
	};

	const onSubmit = (data: CreateProductForm) => {
		execute({ ...data, projectId });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create New Product</DialogTitle>
					<DialogDescription>
						Create a new product for your project.
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
									<FormLabel>Product Name</FormLabel>
									<FormControl>
										<Input placeholder="Product Name" {...field} />
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
								{isPending ? "Creating Product..." : "Create Product"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
