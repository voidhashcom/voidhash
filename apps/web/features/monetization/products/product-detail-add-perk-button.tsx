"use client";

import {
	Button,
	cn,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@voidhash/ui";
import { useState } from "react";
import { createProductPerkAction } from "@/lib/nextjs/server-actions";
import { Check } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Perk } from "@voidhash/db";

export function ProductDetailAddPerkButton({
	productId,
	perks,
	variant = "default",
}: {
	productId: string;
	perks: Perk[];
	variant?: "default" | "secondary";
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const router = useRouter();

	const { execute } = useAction(createProductPerkAction, {
		onExecute: () => {
			toast.loading("Adding perk...");
		},
		onSuccess: () => {
			setTimeout(() => {
				toast.success("Perk added");
			}, 100);

			router.refresh();
		},
		onSettled: () => {
			setTimeout(() => {
				toast.dismiss();
			}, 50);
		},
	});

	const handleSelect = (perkId: string) => {
		execute({
			productId,
			perkId,
		});
		setValue(perkId);
		setOpen(false);
	};
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button role="combobox" aria-expanded={open} variant={variant}>
					Add perk
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandInput placeholder="Search perks..." />
					<CommandList>
						<CommandEmpty>No perks found.</CommandEmpty>
						<CommandGroup>
							{perks.map((perk) => (
								<CommandItem
									key={perk.id}
									value={perk.id}
									className="cursor-pointer"
									onSelect={() => {
										handleSelect(perk.id);
										setValue("");
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === perk.id ? "opacity-100" : "opacity-0"
										)}
									/>
									{perk.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
