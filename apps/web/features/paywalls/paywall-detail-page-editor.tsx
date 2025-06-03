"use client";

import { Button, Card, CardHeader, CardTitle, CardContent } from "@voidhash/ui";
import { PaywallDetailAddProductButton } from "./paywall-detail-add-product-button";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import type {
	GetPaywallByIdResult,
	GetPaywallProductsResult,
} from "@/lib/services/paywalls/queries";
import { GetProductsResult } from "@/lib/services/products/queries";
import { updatePaywallAction } from "@/lib/nextjs/server-actions";

import { useState } from "react";
import type { updatePaywallInputSchema } from "@/lib/services/paywalls/actions/update-paywall";
import { z } from "zod";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PaywallDetailProductRecord } from "./paywall-detail-product-record";

type UpdatePaywallInput = z.infer<typeof updatePaywallInputSchema>;

type UpdatePaywallProduct = NonNullable<
	UpdatePaywallInput["paywallProducts"]
>[number];

const reorderProducts = (
	items: Omit<UpdatePaywallProduct, "order">[]
): UpdatePaywallProduct[] => {
	return [...items.map((item, index) => ({ ...item, order: index }))];
};

export function PaywallDetailPageEditor({
	paywall,
	initialPaywallProducts,
	products,
}: {
	paywall: GetPaywallByIdResult;
	initialPaywallProducts: GetPaywallProductsResult;
	products: GetProductsResult;
}) {
	const router = useRouter();

	const [paywallProducts, setPaywallProducts] = useState<
		UpdatePaywallProduct[]
	>(initialPaywallProducts);

	const productsWithoutAddedProducts = products.filter(
		(product) =>
			!paywallProducts.some(
				(paywallProduct) => paywallProduct.productId === product.id
			)
	);

	const { execute, isPending } = useAction(updatePaywallAction, {
		onSuccess: () => {
			toast.success("Paywall saved successfully");
			router.refresh();
		},
		onError: (error) => {
			toast.error(error.error.serverError || "Failed to create perk");
		},
	});

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			setPaywallProducts((items) => {
				const oldIndex = items.findIndex(
					(item) => item.productId === active.id
				);
				const newIndex = items.findIndex((item) => item.productId === over.id);
				return reorderProducts(arrayMove(items, oldIndex, newIndex));
			});
		}
	};

	const handleAddPaywallProduct = (productId: string) => {
		const product = products.find((p) => p.id === productId);
		if (!product) {
			toast.error("Product not found");
			return;
		}
		setPaywallProducts((prevProducts) => {
			const newProduct = {
				productId,
				displayName: product.name,
				order: prevProducts.length,
				enableNativePurchase: true,
				enableWebCheckout: false,
				webCheckoutPaymentProviderId: null,
			};
			return reorderProducts([...prevProducts, newProduct]);
		});
	};

	const handleUpdatePaywallProduct = (paywallProduct: UpdatePaywallProduct) => {
		setPaywallProducts((prevProducts) =>
			reorderProducts(
				prevProducts.map((p) => {
					if (p.productId === paywallProduct.productId) {
						return { ...p, ...paywallProduct }; // Ensure order is preserved or updated correctly if part of paywallProduct
					}
					return p;
				})
			)
		);
	};

	const handleRemovePaywallProduct = (productId: string) => {
		setPaywallProducts((prevProducts) =>
			reorderProducts(prevProducts.filter((p) => p.productId !== productId))
		);
	};

	const onSubmit = () => {
		execute({
			paywallProducts: paywallProducts,
			paywallId: paywall.id,
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-row items-center justify-between">
				<h1 className="text-3xl font-normal tracking-right">{paywall.name}</h1>
				<Button type="submit" disabled={isPending} onClick={onSubmit}>
					{isPending ? "Saving..." : "Save changes"}
				</Button>
				{/* <CreateProductModalButton projectId={project.id} /> */}
			</div>

			<div className="mt-8">
				<Card className="pb-0 mt-8 gap-0 bg-background">
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-4">Products</CardTitle>
					</CardHeader>
					<CardContent className="px-0">
						{/* Emtpy State */}
						{paywallProducts.length === 0 && (
							<div className="flex flex-col items-center justify-center h-full py-6">
								<div className="text-muted-foreground">
									This paywall does not have any products added yet.
								</div>
								<div className="mt-4">
									<PaywallDetailAddProductButton
										products={productsWithoutAddedProducts}
										onAdd={(productId) => handleAddPaywallProduct(productId)}
									/>
								</div>
							</div>
						)}

						<DndContext
							id="paywall-products-dnd-context"
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							{paywallProducts.length > 0 && (
								<div className="p-4 flex-col space-y-4">
									<SortableContext
										items={paywallProducts.map((p) => p.productId)}
										strategy={verticalListSortingStrategy}
									>
										{paywallProducts.map((paywallProduct) => {
											const product = products.find(
												(p) => p.id === paywallProduct.productId
											);
											if (!product) {
												return null;
											}
											return (
												<PaywallDetailProductRecord
													key={paywallProduct.productId}
													product={product}
													paywallProduct={paywallProduct}
													onUpdate={handleUpdatePaywallProduct}
													onRemove={() =>
														handleRemovePaywallProduct(paywallProduct.productId)
													}
												/>
											);
										})}
									</SortableContext>
									<div className="mt-4">
										<PaywallDetailAddProductButton
											products={productsWithoutAddedProducts}
											onAdd={(productId) => handleAddPaywallProduct(productId)}
											variant="outline"
										/>
									</div>
								</div>
							)}
						</DndContext>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
