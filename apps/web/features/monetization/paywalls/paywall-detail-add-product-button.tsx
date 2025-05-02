"use client";

import {
	Button,
	cn,
	CommandEmpty,
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@voidhash/ui";
import { Check, PlusIcon } from "lucide-react";
import { useState } from "react";
import { type getProducts } from "@/lib/services/products/queries";
import { createPaywallProductAction } from "@/lib/nextjs/server-actions";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Product = Awaited<ReturnType<typeof getProducts>>[number];

export function PaywallDetailAddProductButton({
	products,
	paywallId,
	variant = "default",
}: {
	products: Product[];
	paywallId: string;
	variant?: "default" | "secondary";
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const router = useRouter();

	const { execute } = useAction(createPaywallProductAction, {
		onExecute: () => {
			toast.loading("Adding product...");
		},
		onSuccess: () => {
			toast.success("Product added");
			router.refresh();
		},
		onSettled: () => {
			toast.dismiss();
		},
	});

	const handleSelect = (productId: string) => {
		execute({
			productId,
			paywallId: paywallId,
		});
		setValue(productId);
		setOpen(false);
	};

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button role="combobox" aria-expanded={open} variant={variant}>
						Add product
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[200px] p-0">
					<Command>
						<CommandInput placeholder="Search product..." />
						<CommandList>
							<CommandEmpty>No products found.</CommandEmpty>
							<CommandGroup>
								{products.map((product) => (
									<CommandItem
										key={product.id}
										value={product.id}
										className="cursor-pointer"
										onSelect={() => {
											handleSelect(product.id);
											setValue("");
											setOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												value === product.id ? "opacity-100" : "opacity-0"
											)}
										/>
										{product.name}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
}
