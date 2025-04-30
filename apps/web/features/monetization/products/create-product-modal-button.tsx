"use client";
import { useState } from "react";
import { Button } from "@voidhash/ui/button";
import { CreateProductModal } from "./create-product-modal";

export function CreateProductModalButton({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<CreateProductModal
				open={open}
				onClose={() => setOpen(false)}
				trigger={<Button onClick={() => setOpen(true)}>Add Product</Button>}
				projectId={projectId}
				onSuccess={() => setOpen(false)}
			/>
		</>
	);
}
