"use client";

import { Button } from "@voidhash/ui";
import { ProviderProductSheet } from "./provider-product-sheet";
import { useState } from "react";

export function ProductDetailAddProductButton({
	productId,
	providerId,
	title,
	variant = "default",
}: {
	productId: string;
	providerId: string;
	title: string;
	variant?: "default" | "secondary";
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button type="submit" variant={variant} onClick={() => setOpen(true)}>
				Add {title} product
			</Button>
			<ProviderProductSheet
				open={open}
				onClose={() => setOpen(false)}
				productId={productId}
				providerId={providerId}
				mode={"add"}
			/>
		</>
	);
}
