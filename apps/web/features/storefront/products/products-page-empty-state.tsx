"use client";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@voidhash/ui";
import { useState } from "react";
import { CreateProductModal } from "./create-product-modal";

export function ProductsPageEmptyState({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No products yet</CardTitle>
				<CardDescription className="max-w-md text-balance mx-auto">
					Products are items customers can purchase (e.g. Gold Monthly, Gold
					Yearly, All-Access Pass etc.). Get started by creating a product.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CreateProductModal
					open={open}
					onClose={() => setOpen(false)}
					trigger={
						<Button onClick={() => setOpen(true)}>Create product</Button>
					}
					projectId={projectId}
					onSuccess={() => setOpen(false)}
				/>
			</CardContent>
		</Card>
	);
}
