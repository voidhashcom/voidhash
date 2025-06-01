"use client";

import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { updateProductAction } from "@/lib/nextjs/server-actions";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@voidhash/db";

const updateProductSchema = z.object({
	name: z.string().min(1),
});
type UpdateProductForm = z.infer<typeof updateProductSchema>;

// Define a Product type matching the DB schema

interface EditProductModalProps {
	open: boolean;
	onClose: () => void;
	product: Product;
}

export function EditProductModal({
	open,
	onClose,
	product,
}: EditProductModalProps) {
	const router = useRouter();
	const form = useForm<UpdateProductForm>({
		resolver: zodResolver(updateProductSchema),
		defaultValues: {
			name: "",
		},
	});

	const { execute, isPending } = useAction(updateProductAction, {
		onSuccess: () => {
			toast.success("Product updated successfully");
			router.refresh();
			onClose?.();
			handleOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.error.serverError || "Failed to update the product");
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
			form.reset();
		}
	};

	const onSubmit = (data: UpdateProductForm) => {
		execute({ ...data, productId: product.id });
	};

	useEffect(() => {
		if (open) {
			form.reset({
				name: product.name,
			});
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Edit Product</DialogTitle>
					<DialogDescription>Edit the product details.</DialogDescription>
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
								<FormItem className="space-y-1">
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
								{isPending ? "Saving..." : "Save Changes"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
