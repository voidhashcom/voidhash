'use client';

import type { Perk } from '@voidhash/db';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { ProductDetailAddPerkButton } from './product-detail-add-perk-button';

export function ProductDetailPerksEmptyState({
  productId,
  perks
}: {
  productId: string;
  perks: Perk[];
}) {
  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No perks configured</CardTitle>
        <CardDescription>
          Add perks that will be unlocked when this product is purchased.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProductDetailAddPerkButton perks={perks} productId={productId} />
      </CardContent>
    </Card>
  );
}
