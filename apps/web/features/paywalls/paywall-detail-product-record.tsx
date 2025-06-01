"use client";

import {
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	FormField,
	FormControl,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Form,
} from "@voidhash/ui";
import { EllipsisVerticalIcon, GripVerticalIcon } from "lucide-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product } from "@voidhash/db";
import { useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const paywallProductSchema = z.object({
	productId: z.string().min(1, "Product ID is required"),
	displayName: z
		.string()
		.min(2, "Display name must be at least 2 characters long"),
});

type PaywallProductForm = z.infer<typeof paywallProductSchema>;

export function PaywallDetailProductRecord({
	product,
	paywallProduct,
	onUpdate,
	onRemove,
}: {
	product: Product;
	paywallProduct: {
		productId: string;
		displayName: string;
	};
	onUpdate: (data: PaywallProductForm) => void;
	onRemove: () => void;
}) {
	const form = useForm<PaywallProductForm>({
		resolver: zodResolver(paywallProductSchema),
		defaultValues: {
			productId: paywallProduct.productId,
			displayName: paywallProduct.displayName,
		},
	});

	const handleOnUpdate = (data: Partial<PaywallProductForm>) => {
		onUpdate({
			...form.getValues(),
			...data,
		});
	};

	// Makes the form "controlled"
	useEffect(() => {
		form.reset(paywallProduct);
	}, [paywallProduct, form]);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: paywallProduct.productId });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 1 : undefined, // Ensure the dragged item is on top
	};

	return (
		<Form {...form}>
			<div className="space-y-6" ref={setNodeRef} style={style}>
				<Card className="pb-0 pt-3 gap-3">
					<CardHeader className="pr-3 pl-3">
						<div className="flex flex-row items-center justify-between">
							<CardTitle className="flex flex-row items-center gap-2">
								<div
									className="cursor-grab p-2 hover:bg-muted rounded-md"
									{...attributes}
									{...listeners}
								>
									<GripVerticalIcon
										size={16}
										className="text-muted-foreground"
									/>
								</div>
								<div>{product.name}</div>
							</CardTitle>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="icon" className="z-20">
										<EllipsisVerticalIcon className="w-4 h-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="w-48" align="end">
									<DropdownMenuItem onSelect={onRemove}>
										Remove
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</CardHeader>
					<CardContent className="border-t border-border divide-y divide-border py-6">
						<FormField
							control={form.control}
							name={"displayName"}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Display name</FormLabel>
									<FormControl>
										<Input
											{...field}
											className="mt-2"
											placeholder="Example: Monthly subscription"
											onChange={(e) => {
												handleOnUpdate({
													displayName: e.target.value,
												});
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>
			</div>
		</Form>
	);
}
