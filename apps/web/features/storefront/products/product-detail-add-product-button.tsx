"use client";

import { Button } from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { ProviderProductSheet } from "./provider-product-sheet";
import { useState } from "react";

export function ProductDetailAddProductButton({
	productId,
	providerId,
	title,
}: {
	productId: string;
	providerId: string;
	title: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button type="submit" variant={"secondary"} onClick={() => setOpen(true)}>
				<PlusIcon className="w-4 h-4 mr-1 text-muted-foreground" />
				<span>Add {title} product</span>
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
