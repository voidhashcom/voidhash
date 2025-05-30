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
import { Check } from "lucide-react";
import { useState } from "react";
import type { Product } from "@voidhash/db";

export function PaywallDetailAddProductButton({
	products,
	variant = "default",
	onAdd,
}: {
	products: Product[];
	variant?: "default" | "secondary";
	onAdd: (productId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");

	const handleSelect = (productId: string) => {
		onAdd(productId);
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
