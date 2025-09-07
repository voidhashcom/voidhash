'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import type { Paywall, PaywallProduct, Product } from '@voidhash/db';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@voidhash/ui';
import type { Schema } from 'effect';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import type { updatePaywallInputSchema } from '@/lib/nextjs/schema';
import { updatePaywallAction } from '@/lib/nextjs/server-actions';
import { PaywallDetailAddProductButton } from './paywall-detail-add-product-button';
import { PaywallDetailProductRecord } from './paywall-detail-product-record';

type UpdatePaywallInput = Schema.Schema.Type<typeof updatePaywallInputSchema>;

type UpdatePaywallProduct = NonNullable<
  UpdatePaywallInput['paywallProducts']
>[number];

const reorderProducts = (
  items: Omit<UpdatePaywallProduct, 'order'>[]
): UpdatePaywallProduct[] => {
  return [...items.map((item, index) => ({ ...item, order: index }))];
};

export function PaywallDetailPageEditor({
  paywall,
  initialPaywallProducts,
  products
}: {
  paywall: Paywall;
  initialPaywallProducts: PaywallProduct[];
  products: Product[];
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
      toast.success('Paywall saved successfully');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.error.serverError || 'Failed to create perk');
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
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
      toast.error('Product not found');
      return;
    }
    setPaywallProducts((prevProducts) => {
      const newProduct = {
        productId,
        displayName: product.name,
        order: prevProducts.length,
        enableNativePurchase: true,
        enableWebCheckout: false,
        webCheckoutPaymentProviderConfigurationProductId: null
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
      paywallProducts,
      paywallId: paywall.id
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">{paywall.name}</h1>
        <Button disabled={isPending} onClick={onSubmit} type="submit">
          {isPending ? 'Saving...' : 'Save changes'}
        </Button>
        {/* <CreateProductModalButton projectId={project.id} /> */}
      </div>

      <div className="mt-8">
        <Card className="mt-8 gap-0 bg-background pb-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-4">Products</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {/* Emtpy State */}
            {paywallProducts.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-6">
                <div className="text-muted-foreground">
                  This paywall does not have any products added yet.
                </div>
                <div className="mt-4">
                  <PaywallDetailAddProductButton
                    onAdd={(productId) => handleAddPaywallProduct(productId)}
                    products={productsWithoutAddedProducts}
                  />
                </div>
              </div>
            )}

            <DndContext
              collisionDetection={closestCenter}
              id="paywall-products-dnd-context"
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              {paywallProducts.length > 0 && (
                <div className="flex-col space-y-4 p-4">
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
                          onRemove={() =>
                            handleRemovePaywallProduct(paywallProduct.productId)
                          }
                          onUpdate={handleUpdatePaywallProduct}
                          paywallProduct={paywallProduct}
                          product={product}
                        />
                      );
                    })}
                  </SortableContext>
                  <div className="mt-4">
                    <PaywallDetailAddProductButton
                      onAdd={(productId) => handleAddPaywallProduct(productId)}
                      products={productsWithoutAddedProducts}
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
