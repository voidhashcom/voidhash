"use client";

import { type getPerks } from "@/lib/services/perks/queries";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@voidhash/ui";
import { ProductDetailAddPerkButton } from "./product-detail-add-perk-button";

export function ProductDetailPerksEmptyState({
	productId,
	perks,
}: {
	productId: string;
	perks: Awaited<ReturnType<typeof getPerks>>;
}) {
	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No perks configured</CardTitle>
				<CardDescription>
					Add perks that will be unlocked when this product is purchased.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ProductDetailAddPerkButton productId={productId} perks={perks} />
			</CardContent>
		</Card>
	);
}
