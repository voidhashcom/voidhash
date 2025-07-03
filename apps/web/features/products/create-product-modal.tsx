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
import { useRouter } from "next/navigation";
import { Badge, InfoTooltip, RadioGroup, RadioGroupItem } from "@voidhash/ui";
import { ProductTypeLabels, ProductType } from "@voidhash/lib/index";

const createProductSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(32, "Name must be less than 32 characters"),

	type: z.nativeEnum(ProductType),
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
	onSuccess?: (product: {
		id: string;
	}) => void;
}

export function CreateProductModal({
	open,
	onClose,
	trigger,
	projectId,
	onSuccess,
}: CreateProductModalProps) {
	const router = useRouter();
	const form = useForm<CreateProductForm>({
		resolver: zodResolver(createProductSchema),
		defaultValues: {
			name: "",
			type: ProductType.Subscription,
		},
	});

	const { execute, isPending } = useAction(createProductAction, {
		onSuccess: (res) => {
			if (res.data) {
				toast.success("Product created successfully");
				onSuccess?.(res.data);
				router.refresh();
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
						className="space-y-6 pt-4"
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
						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem className="space-y-3">
									<FormLabel>Product type</FormLabel>
									<FormControl>
										<RadioGroup
											onValueChange={field.onChange}
											defaultValue={field.value.toString()}
											className="flex flex-col space-y-1"
										>
											<FormItem className="flex items-center space-x-3 space-y-0">
												<FormControl>
													<RadioGroupItem
														value={ProductType.Subscription.toString()}
													/>
												</FormControl>
												<FormLabel className="font-normal">
													<span>
														{ProductTypeLabels[ProductType.Subscription]}
													</span>
												</FormLabel>
											</FormItem>
											<FormItem className="flex items-center space-x-3 space-y-0 opacity-50">
												<FormControl>
													<RadioGroupItem
														disabled={true}
														value={ProductType.OneTime.toString()}
													/>
												</FormControl>
												<FormLabel className="font-normal">
													<span className="flex items-center gap-2">
														<span>
															{ProductTypeLabels[ProductType.OneTime]}
														</span>
														<Badge variant="outline">Coming Soon</Badge>
													</span>
													<InfoTooltip info="One-time products can only be purchased once per customer. For example: Lifetime access to a course." />
												</FormLabel>
											</FormItem>
											<FormItem className="flex items-center space-x-3 space-y-0 opacity-50">
												<FormControl>
													<RadioGroupItem
														disabled={true}
														value={ProductType.OneTimeConsumable.toString()}
													/>
												</FormControl>
												<FormLabel className="font-normal">
													<span className="flex items-center gap-2">
														<span>
															{ProductTypeLabels[ProductType.OneTimeConsumable]}
														</span>
														<Badge variant="outline">Coming Soon</Badge>
													</span>
													<InfoTooltip info="One-time consumable products can be purchased multiple times. For example: Battle passes, in-game currency, etc." />
												</FormLabel>
											</FormItem>
										</RadioGroup>
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
